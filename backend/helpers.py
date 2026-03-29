from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, tuple_

from database.food import Food
from database.dining_halls import DiningHalls


def _merge_exclusions(
	dish_name: Optional[str],
	dining_hall_id: Optional[UUID],
	exclude_names: Optional[list[str]],
	exclude_dining_hall_ids: Optional[list[UUID]],
) -> list[tuple[str, UUID]]:
	"""Build a deduplicated list of (name, dining_hall_id) pairs to exclude."""
	exclusions: list[tuple[str, UUID]] = []
	has_legacy = dish_name is not None or dining_hall_id is not None
	if has_legacy:
		if dish_name is None or dining_hall_id is None:
			raise ValueError(
				"dish_name and dining_hall_id must both be provided to exclude a dish, or omit both."
			)
		exclusions.append((dish_name, dining_hall_id))

	names = exclude_names or []
	hall_ids = exclude_dining_hall_ids or []
	if len(names) != len(hall_ids):
		raise ValueError(
			"exclude_names and exclude_dining_hall_ids must have the same length."
		)
	exclusions.extend(zip(names, hall_ids))

	seen: set[tuple[str, UUID]] = set()
	out: list[tuple[str, UUID]] = []
	for pair in exclusions:
		if pair not in seen:
			seen.add(pair)
			out.append(pair)
	return out

class PagesResponse(BaseModel):
    page_count: int

class DishInfo(BaseModel):
	dish_name: str
	dining_hall_id: UUID
	dining_hall_name: str
	nutrition_info: dict[str, Any]
	elo_rating: float

class RandomMealsResponse(BaseModel):
	meals: list[DishInfo]

async def handle_get_elo(
    db_session: AsyncSession,
    limit: int,
    offset: int, 
    dining_hall: str ,
        ):

    stmt = (
            select(Food)
            .order_by(Food.elo_rating.desc())
            .limit(limit)
            .offset(offset)
            )

    if dining_hall != 'Global':
        stmt = stmt.where(Food.dining_hall_id == dining_hall)
    
    res = await db_session.execute(stmt)
    entries = res.scalars().all()

    return entries


async def get_random_meals_from_db(
	db_session: AsyncSession,
	count: int,
	dish_name: Optional[str] = None,
	dining_hall_id: Optional[UUID] = None,
	exclude_names: Optional[list[str]] = None,
	exclude_dining_hall_ids: Optional[list[UUID]] = None,
) -> RandomMealsResponse:
	"""
	Two behaviors:

	- ``count == 2``: return two random meals. Exclusion parameters are ignored.
	- ``count == 1``: return one random meal. Optionally exclude one or more dishes
	  by composite key: legacy ``dish_name`` + ``dining_hall_id``, and/or parallel
	  lists ``exclude_names`` / ``exclude_dining_hall_ids`` (same length).
	"""
	stmt = select(Food, DiningHalls).join(DiningHalls, Food.dining_hall_id == DiningHalls.id)

	if count == 1:
		exclusions = _merge_exclusions(
			dish_name, dining_hall_id, exclude_names, exclude_dining_hall_ids
		)
		if exclusions:
			stmt = stmt.where(~tuple_(Food.name, Food.dining_hall_id).in_(exclusions))
	# count == 2: no exclusion filter

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
				nutrition_info=food.nutrition_info,
				elo_rating=food.elo_rating
			) for food, dining_hall in entries
		]
	)

async def handle_get_pagination(db_session: AsyncSession, limit: int) -> PagesResponse:
    """
    Gets two random meal from the database.
    """
    stmt = select(func.count("*")).select_from(Food)
    res = await db_session.execute(stmt)
    count = res.scalar_one()
    pages = math.ceil(count / limit)

    return PagesResponse(page_count=pages)
