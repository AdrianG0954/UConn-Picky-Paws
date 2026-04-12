from uuid import UUID
import urllib.parse
from typing import Annotated, List, Optional, Dict
import xml.etree.ElementTree as ET

from dotenv import load_dotenv
import httpx
from fastapi import Depends, Query, Request, WebSocket
from fastapi.responses import RedirectResponse, Response
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.exceptions import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

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
from backend.parse_dishes import ParseDishes, DiningHallEnum
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

        # calculate the new elo for the winning and losing dishes
        winner_new_elo, loser_new_elo = await CalculateElo(db_session=db_session).calculate_elo(
            request=request
        )

        manager = app_request.app.state.connection_manager
        affected_dining_hall_ids = {
            request.winner.dining_hall_id,
            request.loser.dining_hall_id,
        }
        try:
            # publish leaderboard snapshots to all ws subscribers
            await publish_leaderboard_snapshots(
                db_session=db_session,
                manager=manager,
                affected_dining_hall_ids=affected_dining_hall_ids,
            )
        except Exception:
            logger.exception("Failed to publish leaderboard snapshots after Elo update.")

        return EloUpdateResponse(
            winner_new_elo=winner_new_elo,
            loser_new_elo=loser_new_elo,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
    exclude_names: Annotated[Optional[List[str]], Query(description="Parallel to exclude_dining_hall_ids when count=1.")] = None,
    exclude_dining_hall_ids: Annotated[Optional[List[UUID]], Query(description="Parallel to exclude_names; same length.")] = None,
) -> RandomMealsResponse:
    """Random pair for head-to-head (count=2) or one replacement dish (count=1 + exclusions)."""
    try:
        # verify the user is authenticated (will raise an exception if not)
        AuthService().verify_login_jwt(credentials)

        response = await get_random_meals_from_db(
            db_session=db_session,
            count=int(count),
            filter_dining_halls=filter_dining_halls,
            exclude_names=exclude_names,
            exclude_dining_hall_ids=exclude_dining_hall_ids,
        )
        return response
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error fetching dining halls: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while fetching menu")


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
        await websocket.close(code=1008)
        return
    try:
        AuthService().verify_login_jwt(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        )
    except HTTPException:
        await websocket.close(code=1008)
        return

    manager = websocket.app.state.connection_manager
    try:
        return await handle_leaderboard_websocket(websocket, manager, _db_session_maker)
    except Exception as exc:
        logger.error(f"Error handling leaderboard websocket: {exc}", exc_info=True)
        await websocket.close(code=1011)
        return


@app.get("/meals/menu/{hall_name}", status_code=200)
async def get_menu(
    hall_name: str,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    dtdate: Optional[str] = Query(default=None, description="Optionally fetch a specific date's menu. Format: MM/DD/YYYY"),
) -> Dict:
    try:
        hall_info = DiningHallEnum[hall_name.upper().replace(" ", "_")]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Verify hall name {hall_name} is valid")

    try:
        # verify the user is authenticated (will raise an exception if not)
        AuthService().verify_login_jwt(credentials)

        return await ParseDishes().get_dining_hall_menu(hall_info, dtdate)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error fetching menu for {hall_name}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail="Internal server error while fetching menu"
        )
