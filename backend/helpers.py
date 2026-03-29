from typing import Any
from pydantic import BaseModel

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database.food import Food

class DishInfo(BaseModel):
	name: str
	nutrition_info: dict[str, Any]
	elo_rating: float

class RandomMealsResponse(BaseModel):
	meals: list[DishInfo]


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

	