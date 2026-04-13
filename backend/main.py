from uuid import UUID
from typing import Annotated, List, Optional, Dict

from dotenv import load_dotenv
from fastapi import Depends, Query, Request, WebSocket
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
from backend.parse_dishes import ParseDishes, DiningHallEnum
from backend.server import logger, app, request_db_session, _db_session_maker


load_dotenv()  # Load environment variables from .env file


@app.get("/health")
def health():
    return {"status": "ok"}


@app.patch("/meals/elo", status_code=200, response_model=EloUpdateResponse)
async def update_elo(
    request: EloBody,
    db_session: Annotated[AsyncSession, Depends(request_db_session)],
    app_request: Request,
) -> EloUpdateResponse:
    try:
        winner_new_elo, loser_new_elo = await CalculateElo(db_session=db_session).calculate_elo(
            request=request
        )
        await db_session.flush()

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
        logger.error(f"Error updating Elo: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to update Elo")
    except Exception as exc:
        logger.error(f"Error updating Elo: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while updating Elo")


@app.get("/meals/random", status_code=200)
async def get_random_meals(
    db_session: Annotated[AsyncSession, Depends(request_db_session)],
    filter_dining_halls: Annotated[List[str], Query(description="Filter results to only the specified dining halls")],
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
        response = await get_random_meals_from_db(
            db_session=db_session,
            count=int(count),
            filter_dining_halls=filter_dining_halls,
            exclude_names=exclude_names,
            exclude_dining_hall_ids=exclude_dining_hall_ids,
        )
        return response
    except ValueError as ve:
        logger.error(f"Error fetching random meals: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to fetch random meals")
    except Exception as e:
        logger.error(f"Error fetching random meals: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while fetching random meals")


@app.get("/dining-halls", status_code=200, response_model=list[DiningHallSummary])
async def dining_halls(
    db_session: Annotated[AsyncSession, Depends(request_db_session)],
) -> list[DiningHallSummary]:
    try:
        return await DiningHallRepository(db_session).get_dining_halls()
    except ValueError as ve:
        logger.error(f"Error fetching dining halls: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail="Failed to fetch dining halls")
    except Exception as exc:
        logger.error(f"Error fetching dining halls: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while fetching dining halls")


@app.websocket("/ws/leaderboard")
async def websocket_leaderboard(websocket: WebSocket):
    """
    WebSocket endpoint for the leaderboard

    TL;DR; User subscribes to the leaderboard for live updates. 
    When the elo of a dish in their subscribed board changes, 
    we send them the updated leaderboard.
    """
    manager = websocket.app.state.connection_manager
    return await handle_leaderboard_websocket(websocket, manager, _db_session_maker)


@app.get("/meals/menu/{hall_name}", status_code=200)
async def get_menu(
    hall_name: str,
    dtdate: Optional[str] = Query(default=None, description="Optionally fetch a specific date's menu. Format: MM/DD/YYYY"),
) -> Dict:
    try:
        hall_info = DiningHallEnum[hall_name.upper().replace(" ", "_")]
    except KeyError:
        raise HTTPException(
            status_code=404, 
            detail=f"Dining hall '{hall_name}' not found"
        )

    try:
        return await ParseDishes().get_dining_hall_menu(hall_info, dtdate)
    except Exception as exc:
        logger.error(f"Error fetching menu for {hall_name}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail="Internal server error while fetching menu"
        )


@app.get("/meals/availability/{food_item}", status_code=200, response_model=DishAvailabilityResponse)
async def get_meal_availability(
    food_item: str,
    hall_name: str = Query(description="Filter availability to a specific dining hall"),
) -> DishAvailabilityResponse:
    try:
        hall_info = DiningHallEnum[hall_name.upper().replace(" ", "_")]
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Dining hall '{hall_name}' not found",
        ) from exc

    try:
        return await get_dish_availability(food_item, hall_info)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(f"Error warming weekly menu cache for {food_item}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching availability",
        )
