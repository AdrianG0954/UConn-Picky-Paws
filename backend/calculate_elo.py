import math
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel

from database.dining_halls import DiningHalls
from database.food import Food

class DishBody(BaseModel):
	d_id: UUID
	name: str


class EloBody(BaseModel):
	winner: DishBody
	loser: DishBody
	draw: bool

	
class CalculateElo:
	def __init__(self, db_session: AsyncSession):
		self.db_session = db_session
		self.k = 30


	def calculate_probability(self, a: float, b: float) -> float:
		"""
		ELO probability formula.
		"""
		return 1.0 / (1.0 + math.pow(10, (a - b) / 400.0))

		
	async def calculate_elo(self, request: EloBody) -> None:
		"""
		Calculates new ELO for the winning dish and the losing dish.
		"""

		# K-factor; how much to adjust the elo by; can be adjusted
		outcome = 0.5 if request.draw else 1.0

		loser_elo = await self.get_elo(request.loser.name, request.loser.d_id)
		winner_elo = await self.get_elo(request.winner.name, request.winner.d_id)

		probability_winner = self.calculate_probability(loser_elo, winner_elo)
		probability_loser = self.calculate_probability(winner_elo, loser_elo)

		winner_new_elo = winner_elo + self.k * (outcome - probability_winner)
		loser_new_elo = loser_elo + self.k * ((1.0 - outcome) - probability_loser)

		await self.update_elo(request.winner.name, request.winner.d_id, winner_new_elo)
		await self.update_elo(request.loser.name, request.loser.d_id, loser_new_elo)


	async def update_elo(self, name: str, d_id: UUID, new_elo: float) -> None:
		"""
		Updates the Elo rating for a dish in the database.
		"""
		stmt = (
			update(Food)
		  	.where(Food.dining_hall_id == d_id, Food.name == name)
			.values(elo_rating=new_elo)
		)
		
		try:
			await self.db_session.execute(stmt)
			await self.db_session.flush()
		except Exception as e:
			raise RuntimeError(f"Failed to update Elo rating for '{name}' in dining hall with ID {d_id}: {str(e)}")


	async def get_elo(self, name: str, d_id: UUID) -> float:
		"""
		Fetches the current Elo rating for a dish from the database.
	    """
		stmt = select(Food).where(Food.dining_hall_id == d_id, Food.name == name)
		res = await self.db_session.execute(stmt)
		entry = res.scalar_one_or_none()

		if entry is None:
			raise ValueError(f"Food '{name}' not found in dining hall with ID {d_id}.")
       
		return entry.elo_rating
