import math
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select, update
from pydantic import AliasChoices, BaseModel, ConfigDict, Field


from database.food import Food


class DishBody(BaseModel):
	model_config = ConfigDict(populate_by_name=True)

	dining_hall_id: UUID = Field(
		validation_alias=AliasChoices("dining_hall_id", "d_id"),
		description="Dining hall UUID; accepts legacy key `d_id` in JSON.",
	)
	name: str


class EloBody(BaseModel):
	winner: DishBody
	loser: DishBody
	draw: bool


class EloUpdateResponse(BaseModel):
	winner_new_elo: float
	loser_new_elo: float

	
class CalculateElo:
	def __init__(self, db_session: AsyncSession):
		self.db_session = db_session
		self.k = 30


	def calculate_probability(self, a: float, b: float) -> float:
		"""
		ELO probability formula.
		"""
		return 1.0 / (1.0 + math.pow(10, (a - b) / 400.0))

		
	async def calculate_elo(self, request: EloBody) -> tuple[float, float]:
		"""
		Calculates new ELO for the winning dish and the losing dish.
		Returns (winner_new_elo, loser_new_elo).

		"""

		# K-factor; how much to adjust the elo by; can be adjusted
		outcome = 0.5 if request.draw else 1.0

		loser_elo = await self.get_elo(request.loser.name, request.loser.dining_hall_id)
		winner_elo = await self.get_elo(request.winner.name, request.winner.dining_hall_id)

		probability_winner = self.calculate_probability(loser_elo, winner_elo)
		probability_loser = self.calculate_probability(winner_elo, loser_elo)

		winner_new_elo = winner_elo + self.k * (outcome - probability_winner)
		loser_new_elo = loser_elo + self.k * ((1.0 - outcome) - probability_loser)

		await self.update_elo(request.winner.name, request.winner.dining_hall_id, winner_new_elo)
		await self.update_elo(request.loser.name, request.loser.dining_hall_id, loser_new_elo)

		return winner_new_elo, loser_new_elo


	async def update_elo(self, food: Food, new_elo: float) -> None:
		"""
		Updates the Elo rating for a dish in the database.
		"""
		try:
			food.elo_rating = new_elo
			await self.db_session.flush()
		except Exception as e:
			raise RuntimeError(
				f"Failed to update Elo rating for '{food.name}' in dining hall with ID "
				f"{food.dining_hall_id}: {str(e)}"
			)


	async def get_food(self, name: str, d_id: UUID) -> Food:
		"""
		Fetches a dish from the database.
	    """
		stmt = select(Food).where(Food.dining_hall_id == d_id, Food.name == name)
		res = await self.db_session.execute(stmt)
		entry = res.scalar_one_or_none()

		if entry is None:
			raise ValueError(f"Food '{name}' not found in dining hall with ID {d_id}.")

		return entry
