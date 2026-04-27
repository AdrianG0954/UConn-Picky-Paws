import math
from uuid import UUID
from typing import Tuple, Dict, Set

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from database.dishes import Dishes


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

		# lock dishes for duration of the transaction
		winner_pk = (request.winner.dining_hall_id, request.winner.name)
		loser_pk = (request.loser.dining_hall_id, request.loser.name)
		elos = await self.lock_elos_for_update({winner_pk, loser_pk})
		winner_elo = elos[winner_pk]
		loser_elo = elos[loser_pk]

		probability_winner = self.calculate_probability(loser_elo, winner_elo)
		probability_loser = self.calculate_probability(winner_elo, loser_elo)

		winner_new_elo = winner_elo + self.k * (outcome - probability_winner)
		loser_new_elo = loser_elo + self.k * ((1.0 - outcome) - probability_loser)

		await self.update_elo(
			request.winner.name,
			request.winner.dining_hall_id,
			winner_new_elo,
		)
		await self.update_elo(
			request.loser.name,
			request.loser.dining_hall_id,
			loser_new_elo,
		)

		return winner_new_elo, loser_new_elo


	async def lock_elos_for_update(self, pks: Set[Tuple]) -> dict[Tuple, float]:
		"""
		Locks each dish row for duration of the transaction. 
		We do this to prevent race conditions with updates to the same dish.
		"""
		# sort to prevent possible deadlock
		ordered = sorted(pks)
		out: Dict[Tuple, float] = {}
		for dining_hall_id, name in ordered:
			stmt = (
				select(Dishes.elo_rating)
				.where(
					Dishes.dining_hall_id == dining_hall_id,
					Dishes.name == name,
				)
				.with_for_update()
			)
			res = await self.db_session.execute(stmt)
			elo = res.scalar_one_or_none()
			if elo is None:
				raise ValueError(
					f"Elo rating not found for '{name}' in dining hall {dining_hall_id}."
				)
			out[(dining_hall_id, name)] = float(elo)
		return out


	async def update_elo(
		self, name: str, dining_hall_id: UUID, new_elo: float
	) -> None:
		"""
		Updates the Elo rating for a dish in the database.
		"""
		try:
			stmt = (
				update(Dishes)
				.where(
					Dishes.dining_hall_id == dining_hall_id,
					Dishes.name == name,
				)
				.values(elo_rating=new_elo, matches=Dishes.matches + 1)
			)
			await self.db_session.execute(stmt)
		except Exception as e:
			raise RuntimeError(
				f"Failed to update Elo rating for '{name}' in dining hall {dining_hall_id}: {str(e)}"
			)
