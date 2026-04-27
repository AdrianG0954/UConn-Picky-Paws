from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID
from pydantic import BaseModel
import random
from math import floor

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, tuple_

from database.dishes import Dishes
from database.dining_halls import DiningHalls


def _merge_exclusions(
    exclude_names: Optional[List[str]],
    exclude_dining_hall_ids: Optional[List[UUID]],
) -> List[Tuple[str, UUID]]:
    """
    Build a unique list of (name, dining_hall_id) to exclude.
    """
    names = exclude_names or []
    hall_ids = exclude_dining_hall_ids or []
    if not (len(names) == len(hall_ids)):
        raise ValueError(
            "exclude_names and exclude_dining_hall_ids must have the same length."
        )

    # return only the unique exclusions
    seen: Set[Tuple[str, UUID]] = set()
    out: List[Tuple[str, UUID]] = []
    for name, hall_id in zip(names, hall_ids):
        if (name, hall_id) not in seen:
            seen.add((name, hall_id))
            out.append((name, hall_id))

    return out

class PagesResponse(BaseModel):
    page_count: int

class DishInfo(BaseModel):
    """One dish for JSON APIs; fields align with the ``dishes`` composite PK (hall, name)."""

    dish_name: str
    dining_hall_id: UUID
    dining_hall_name: str
    nutrition_info: Dict[str, Any]
    elo_rating: float

class RandomMealsResponse(BaseModel):
    meals: List[DishInfo]


class LeaderboardEntry(BaseModel):
    name: str
    dining_hall_id: UUID
    dining_hall_name: str
    nutrition_info: Dict[str, Any]
    elo: float

async def get_leaderboard_entries(
    db_session: AsyncSession,
    limit: int = 100,
    dining_hall_id: Optional[UUID] = None,
) -> List[LeaderboardEntry]:
    
    # Base statement for the global leaderboard query
    stmt = (
        select(Dishes, DiningHalls)
        .join(DiningHalls, Dishes.dining_hall_id == DiningHalls.id)
        .order_by(Dishes.elo_rating.desc(), Dishes.name.asc())
        .limit(limit)
    )

    if dining_hall_id is not None:
        stmt = stmt.where(Dishes.dining_hall_id == dining_hall_id)

    res = await db_session.execute(stmt)
    entries = res.all()

    return [
        LeaderboardEntry(
            name=dish.name,
            dining_hall_id=dish.dining_hall_id,
            dining_hall_name=dining_hall.name,
            nutrition_info=dish.nutrition_info,
            elo=dish.elo_rating,
        )
        for dish, dining_hall in entries
    ]

async def get_random_meals_from_db(
    db_session: AsyncSession,
    count: int,
    filter_dining_halls: List[str],
    exclude_names: Optional[List[str]] = None,
    exclude_dining_hall_ids: Optional[List[UUID]] = None,
    winner_dining_hall_id: Optional[UUID] = None,
    winner_name: Optional[str] = None
) -> RandomMealsResponse:
    """
    Two behaviors:

    - ``count == 2``: return two random meals. Exclusion parameters are ignored.
    - ``count == 1``: return one random meal. Optionally exclude dishes by composite
    key: parallel lists ``exclude_names``, ``exclude_dining_hall_ids`` (same length).

    NOTE: filter_dining_halls is to limit the results to only the halls the user specifies.
    """
    entries = None
    stmt = select(Dishes, DiningHalls).join(DiningHalls, Dishes.dining_hall_id == DiningHalls.id).where(DiningHalls.name.in_(filter_dining_halls))

    if count == 1:
        if winner_dining_hall_id is None or winner_name is None:
            raise ValueError("winner_dining_hall_id and winner_name must be provided when count is 1")

        winner_stmt = select(Dishes).where(Dishes.dining_hall_id == winner_dining_hall_id, Dishes.name == winner_name)
        winner_res = await db_session.execute(winner_stmt)
        winner_dish = winner_res.scalar_one_or_none()
        if winner_dish is None:
            raise ValueError("winner is not a valid dish")

        # builds a tuple containing all (name, dining_hall_id) to exclude
        exclusions = _merge_exclusions(
            exclude_names, exclude_dining_hall_ids
        )
        if exclusions:
            # only fetch dishes NOT in exclusions (~ means not)
            stmt = stmt.where(
                ~tuple_(Dishes.name, Dishes.dining_hall_id).in_(
                    exclusions
                )
            )

        prob = random.randint(1, 100)
        if prob <= 70:
            calc_win_prob = 1.0 / (1.0 + func.pow(10, (Dishes.elo_rating - winner_dish.elo_rating) / 400.0))
            stmt = (
                stmt
                .order_by(func.abs(calc_win_prob - 0.5).asc())
                .limit(25) # 25 was found to be aggressive but not too agressive
            )
            res = await db_session.execute(stmt)
            entries = [random.choice(res.all())]
        else:
            rows = await db_session.execute(select(func.count()).select_from(stmt.subquery()))
            row_count = rows.scalar() or 0
            stmt = (
                stmt
                .order_by(Dishes.matches.asc())
                .limit(
                    floor(row_count * 0.15)
                )
            )

    # Random is fine since our dataset is not too large (in the thousands)
    if entries is None:
        stmt = stmt.order_by(func.random()).limit(count)
        res = await db_session.execute(stmt)
        entries = res.all()

    return RandomMealsResponse(
        meals=[
            DishInfo(
                dish_name=food.name,
                dining_hall_id=food.dining_hall_id,
                dining_hall_name=dining_hall.name,
                nutrition_info=food.nutrition_info,
                elo_rating=food.elo_rating,
            )
            for food, dining_hall in entries
        ]
    )
