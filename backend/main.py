import logging
import os
from uuid import UUID
from typing import Annotated, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Query, Request, WebSocket
from fastapi.exceptions import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.calculate_elo import CalculateElo, EloBody, EloUpdateResponse
from backend.helpers import (
    DiningHallSummary,
    RandomMealsResponse,
    get_dining_halls,
    get_random_meals_from_db,
)
from backend.ws import (
    ConnectionManager,
    handle_leaderboard_websocket,
    publish_leaderboard_snapshots,
)

load_dotenv()  # Load environment variables from .env file

logger = logging.getLogger(__name__)

app = FastAPI()
app.state.connection_manager = ConnectionManager()

# per-request database session
_engine = create_async_engine(os.getenv("ASYNC_DATABASE_URL"))
_db_session_maker = async_sessionmaker(bind=_engine, expire_on_commit=False)
async def request_db_session():
    """Provide a transactional scope around a series of operations.""" 
    async with _db_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

@app.get("/")
def read_root():
	return {"message": "Hello, world"}


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
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/meals/random", status_code=200)
async def get_random_meals(
    db_session: Annotated[AsyncSession, Depends(request_db_session)],
	count: str = Query(
		default="2",
		pattern="^[1-2]$",
		description="2 = two random meals. 1 = one random meal (optional exclusions via dish_name+dining_hall_id and/or exclude_names+exclude_dining_hall_ids).",
	),
	dish_name: Optional[str] = Query(
		default=None,
		description="With dining_hall_id, excludes one dish when count=1 (legacy). Ignored when count=2.",
	),
	dining_hall_id: Optional[UUID] = Query(
		default=None,
		description="With dish_name, excludes one dish when count=1 (legacy). Ignored when count=2.",
	),
	exclude_names: Annotated[Optional[List[str]], Query(description="Parallel to exclude_dining_hall_ids; exclude multiple dishes when count=1.")] = None,
	exclude_dining_hall_ids: Annotated[Optional[List[UUID]], Query(description="Parallel to exclude_names; same length as exclude_names.")] = None,
) -> RandomMealsResponse:
	try:
		response = await get_random_meals_from_db(
			db_session=db_session,
			count=int(count),
			dish_name=dish_name,
			dining_hall_id=dining_hall_id,
			exclude_names=exclude_names,
			exclude_dining_hall_ids=exclude_dining_hall_ids,
		)
		return response
	except ValueError as ve:
		raise HTTPException(status_code=400, detail=str(ve))
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))

# TODO: Unused. Connect with frontend
# @app.get("/meals/pagination", status_code=200)
# async def get_pagination(
#     db_session: Annotated[AsyncSession, Depends(request_db_session)],
#     limit: int = 10,
# ):
# 	try:
# 		response = await handle_get_pagination(db_session, limit)
# 		return response
# 	except ValueError as ve:
# 		raise HTTPException(status_code=400, detail=str(ve))
# 	except Exception as e:
# 		raise HTTPException(status_code=500, detail=str(e))
@app.get("/dining-halls", status_code=200, response_model=list[DiningHallSummary])
async def dining_halls(
    db_session: Annotated[AsyncSession, Depends(request_db_session)],
) -> list[DiningHallSummary]:
    try:
        return await get_dining_halls(db_session)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.websocket("/ws/leaderboard")
async def websocket_leaderboard(websocket: WebSocket):
    manager = websocket.app.state.connection_manager
    return await handle_leaderboard_websocket(websocket, manager, _db_session_maker)
