from uuid import UUID

from sqlalchemy import select
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.dining_halls import DiningHalls

class DiningHallSummary(BaseModel):
    id: UUID
    name: str

class DiningHallRepository:
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def add_dining_hall(self, dining_hall: DiningHalls):
        self.db_session.add(dining_hall)
        await self.db_session.flush()  # Flush to generate ID for the dining hall if needed

        return dining_hall.id

    async def get_dining_halls(self) -> list[DiningHallSummary]:
        stmt = select(DiningHalls).order_by(DiningHalls.name.asc())
        res = await self.db_session.execute(stmt)

        entries = res.scalars().all()
        return [
            DiningHallSummary(id=entry.id, name=entry.name) for entry in entries
        ]
