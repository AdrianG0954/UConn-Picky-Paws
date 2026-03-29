import math
from typing import Any
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import event, select, func

from database.food import Food

class PagesResponse(BaseModel):
    page_count: int

class DishInfo(BaseModel):
	name: str
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


async def get_random_meals_from_db(db_session: AsyncSession) -> RandomMealsResponse:
	"""
	Gets two random meal from the database.
	"""
	stmt = select(Food).where(Food.elo_rating.isnot(None)).order_by(func.random()).limit(2)

	res = await db_session.execute(stmt)
	entries = res.scalars().all()
	if len(entries) != 2:
		raise ValueError("Failed to get 2 random meals.")

	return RandomMealsResponse(
		meals=[
			DishInfo(
				name=entry.name,
				nutrition_info=entry.nutrition_info,
				elo_rating=entry.elo_rating
			) for entry in entries
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
