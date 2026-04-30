from uuid import UUID
import urllib.parse
from typing import Annotated, List, Optional
import xml.etree.ElementTree as ET

from dotenv import load_dotenv
import httpx
from fastapi import Depends, Query, Request, WebSocket
from fastapi.responses import RedirectResponse, Response
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.exceptions import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.availability import DishAvailabilityResponse, get_dish_availability
from backend.calculate_elo import CalculateElo, EloBody, EloUpdateResponse
from backend.repository.dining_hall_repository import DiningHallSummary, DiningHallRepository
from backend.helpers import (
    RandomMealsResponse,
    get_random_meals_from_db,
)
from backend.ws import (
    handle_leaderboard_websocket,
    publish_leaderboard_snapshots,
)
from backend.parse_dishes import DiningHallEnum
from backend.auth_service import AuthService
from backend.server import (
    logger, app, request_db_session, _db_session_maker, 
    CAS_BASE, SERVICE_URL, CAS_NS, security
)


load_dotenv()  # Load environment variables from .env file


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/login")
def login_using_sso():
    """
    This redirects the user to the UConn SSO page to login.
    """
    redirect_url = urllib.parse.quote(SERVICE_URL, safe="")
    return RedirectResponse(f"{CAS_BASE}/login?service={redirect_url}", status_code=302)


@app.get("/callback")
async def callback(
    ticket: Annotated[Optional[str], Query(description="CAS ticket provided by UConn SSO after login")],
) -> Response:
    if not ticket:
        return Response(content="Failed: Missing ticket", status_code=400)
    
    netid = await validate_cas_ticket(ticket)
    if netid:
        auth_service = AuthService()
        jwt_token = auth_service.create_login_jwt(netid)
        return Response(content=f"Success: {jwt_token}", status_code=200)

    return Response(content="Failed", status_code=401)


async def validate_cas_ticket(ticket):
    service_enc = urllib.parse.quote(SERVICE_URL, safe="")
    validate_url = f"{CAS_BASE}/serviceValidate?service={service_enc}&ticket={urllib.parse.quote(ticket, safe='')}"
    async with httpx.AsyncClient() as client:
        r = await client.get(validate_url, timeout=5.0)
    xml = r.text

    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return None

    success = root.find("cas:authenticationSuccess", CAS_NS)
    if success is None:
        return None

    return success.findtext("cas:user", default="", namespaces=CAS_NS) or None


@app.patch("/meals/elo", status_code=200, response_model=EloUpdateResponse)
async def update_elo(
    request: EloBody,
    db_session: Annotated[AsyncSession, Depends(request_db_session)],
    app_request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> EloUpdateResponse:
    try:
        # verify the user is authenticated (will raise an exception if not)
        AuthService().verify_login_jwt(credentials)

        # updates the elo for the winner and user (in the DB as well)
        winner_new_elo, loser_new_elo = await CalculateElo(db_session=db_session).calculate_elo(
            request=request
        )

        manager = app_request.app.state.connection_manager
        try:
            # Send updates to all scopes that have changed and have subcribers
            await publish_leaderboard_snapshots(
                db_session=db_session,
                manager=manager,
                affected_entries=[request.winner.dining_hall_id, request.loser.dining_hall_id]
            )
        except Exception:
            logger.exception("Failed to publish leaderboard snapshots after Elo update.")

        return EloUpdateResponse(
            winner_new_elo=winner_new_elo,
            loser_new_elo=loser_new_elo,
        )
    except ValueError as ve:
        logger.error(f"Error updating Elo: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to update Elo")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error updating Elo: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while updating Elo")


@app.get("/meals/random", status_code=200)
async def get_random_meals(
    db_session: Annotated[AsyncSession, Depends(request_db_session)],
    filter_dining_halls: Annotated[List[str], Query(description="Filter results to only the specified dining halls")],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    count: str = Query(
        default="2",
        pattern="^[1-2]$",
        description="2 = two random meals. 1 = one random meal (optional exclusions: parallel exclude_names, exclude_dining_hall_ids).",
    ),
    exclude_names: Annotated[Optional[List[str]], Query(description="same as exclude_dining_hall_ids when count=1.")] = None,
    exclude_dining_hall_ids: Annotated[Optional[List[UUID]], Query(description="same as exclude_names; same length.")] = None,
    winner_dining_hall_id: Annotated[Optional[UUID], Query(description="When count=1, the hall id of the dish that won to use for fair matchmaking.")]=None,
    winner_name: Annotated[Optional[str], Query(description="When count=1, the name of the dish that won to use for fair matchmaking.")]=None,
) -> RandomMealsResponse:
    """Random pair for head-to-head (count=2) or one replacement dish (count=1 + exclusions)."""
    try:
        # verify the user is authenticated (will raise an exception if not)
        AuthService().verify_login_jwt(credentials)

        if count == "1" and (winner_dining_hall_id is None or winner_name is None):
            raise ValueError("winner_dining_hall_id and winner_name must be provided when count is 1")

        response = await get_random_meals_from_db(
            db_session=db_session,
            count=int(count),
            filter_dining_halls=filter_dining_halls,
            exclude_names=exclude_names,
            exclude_dining_hall_ids=exclude_dining_hall_ids,
            winner_dining_hall_id=winner_dining_hall_id,
            winner_name=winner_name,
        )
        return response
    except HTTPException:
        raise
    except ValueError as ve:
        logger.error(f"Error fetching random meals: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to fetch random meals")
    except Exception as e:
        logger.error(f"Error fetching random meals: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while fetching random meals")


@app.get("/dining-halls", status_code=200, response_model=list[DiningHallSummary])
async def dining_halls(
    db_session: Annotated[AsyncSession, Depends(request_db_session)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> list[DiningHallSummary]:
    try:
        # verify the user is authenticated (will raise an exception if not)
        AuthService().verify_login_jwt(credentials)

        return await DiningHallRepository(db_session).get_dining_halls()
    except ValueError as ve:
        logger.error(f"Error fetching dining halls: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to fetch dining halls")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error fetching dining halls: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while fetching dining halls")



@app.websocket("/ws/leaderboard")
async def websocket_leaderboard(
    websocket: WebSocket, 
    token: Optional[str] = Query(default=None, description="JWT token for authentication")
) -> None:
    """
    WebSocket endpoint for the leaderboard.

    TL;DR; User subscribes to the leaderboard for live updates. 
    When the elo of a dish in their subscribed board changes,
    we send them the updated leaderboard.

    NOTE: code 1008 signifies a policy error (auth failure in this case). 
    code 1011 signifies an internal server error.
    """
    if not token:
        await websocket.close(code=1008, reason="Missing auth token")
        return
    try:
        AuthService().verify_login_jwt(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        )
    except HTTPException:
        await websocket.close(code=1008, reason="Auth failed")
        return

    manager = websocket.app.state.connection_manager
    try:
        return await handle_leaderboard_websocket(websocket, manager, _db_session_maker)
    except Exception as exc:
        logger.error(f"Error handling leaderboard websocket: {exc}", exc_info=True)
        await websocket.close(code=1011)
        return


@app.get("/meals/availability", status_code=200, response_model=DishAvailabilityResponse)
async def get_meal_availability(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    dish_name: str = Query(description="Dish name"),
    hall_name: str = Query(description="Dining hall name"),
) -> DishAvailabilityResponse:
    try:
        hall_info = DiningHallEnum[hall_name.upper().replace(" ", "_")]
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Dining hall '{hall_name}' not found",
        ) from exc

    try:
        # Verify the user is authenticated 
        AuthService().verify_login_jwt(credentials)

        return await get_dish_availability(dish_name, hall_info)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(
            f"Error fetching weekly availability for {dish_name} in {hall_name}: {exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching availability",
        )
