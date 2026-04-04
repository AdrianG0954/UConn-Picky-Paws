"""
Shared Pydantic response models and DB helpers for meals and leaderboard endpoints.
"""
import math
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, tuple_

from database.dishes import Dishes
from database.dining_halls import DiningHalls


def _merge_exclusions(
	exclude_names: Optional[list[str]],
	exclude_dining_hall_ids: Optional[list[UUID]],
	exclude_meal_types: Optional[list[str]],
) -> list[tuple[str, UUID, str]]:
	"""
	Build a unique list of (name, dining_hall_id, meal_type) triples to exclude.
	"""
	names = exclude_names or []
	hall_ids = exclude_dining_hall_ids or []
	meal_types = exclude_meal_types or []
	if not (len(names) == len(hall_ids) == len(meal_types)):
		raise ValueError(
			"exclude_names, exclude_dining_hall_ids, and exclude_meal_types must have the same length."
		)

	# return only the unique exclusions
	seen: set[tuple[str, UUID, str]] = set()
	out: list[tuple[str, UUID, str]] = []
	for triple in zip(names, hall_ids, meal_types):
		if triple not in seen:
			seen.add(triple)
			out.append(triple)

	return out

class PagesResponse(BaseModel):
    page_count: int

class DishInfo(BaseModel):
	"""One dish for JSON APIs; fields align with the ``dishes`` composite PK (hall, name, meal_type)."""

	dish_name: str
	dining_hall_id: UUID
	dining_hall_name: str
	meal_type: str
	nutrition_info: dict[str, Any]
	elo_rating: float

class RandomMealsResponse(BaseModel):
	meals: list[DishInfo]


class LeaderboardEntry(BaseModel):
    name: str
    dining_hall_id: UUID
    dining_hall_name: str
    elo: float

async def get_leaderboard_entries(
    db_session: AsyncSession,
    limit: int = 10,
    dining_hall_id: UUID | None = None,
) -> list[LeaderboardEntry]:
    
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
            elo=dish.elo_rating,
        )
        for dish, dining_hall in entries
    ]

async def get_random_meals_from_db(
	db_session: AsyncSession,
	count: int,
	exclude_names: Optional[list[str]] = None,
	exclude_dining_hall_ids: Optional[list[UUID]] = None,
	exclude_meal_types: Optional[list[str]] = None,
) -> RandomMealsResponse:
	"""
	Two behaviors:

	- ``count == 2``: return two random meals. Exclusion parameters are ignored.
	- ``count == 1``: return one random meal. Optionally exclude dishes by composite
	  key: parallel lists ``exclude_names``, ``exclude_dining_hall_ids``, ``exclude_meal_types`` (same length).
	"""
	stmt = select(Dishes, DiningHalls).join(DiningHalls, Dishes.dining_hall_id == DiningHalls.id)

	if count == 1:
		# builds a tuple containing all (name, dining_hall_id, meal_type) triples to exclude
		exclusions = _merge_exclusions(
			exclude_names, exclude_dining_hall_ids, exclude_meal_types
		)
		if exclusions:
			# only fetch dishes NOT in exclusions (~ means not)
			stmt = stmt.where(
				~tuple_(Dishes.name, Dishes.dining_hall_id, Dishes.meal_type).in_(
					exclusions
				)
			)

	# TODO: find a more efficient way to implement this
	stmt = stmt.order_by(func.random()).limit(count)

	res = await db_session.execute(stmt)
	entries = res.all()

	if len(entries) != count:
		raise ValueError(f"Failed to get {count} random meals.")

	return RandomMealsResponse(
		meals=[
			DishInfo(
				dish_name=food.name,
				dining_hall_id=food.dining_hall_id,
				dining_hall_name=dining_hall.name,
				meal_type=food.meal_type,
				nutrition_info=food.nutrition_info,
				elo_rating=food.elo_rating,
			)
			for food, dining_hall in entries
		]
	)

async def handle_get_pagination(db_session: AsyncSession, limit: int) -> PagesResponse:
    """Return how many pages exist for a given page size (total dish rows / limit)."""
    stmt = select(func.count("*")).select_from(Dishes)
    res = await db_session.execute(stmt)
    count = res.scalar_one()
    pages = math.ceil(count / limit)

    return PagesResponse(page_count=pages)
