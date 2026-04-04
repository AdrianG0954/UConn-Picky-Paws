from uuid import UUID, uuid4
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.dining_halls import DiningHalls

class DiningHallSummary(BaseModel):
    id: UUID
    name: str

class DiningHallRepository:
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def add_dining_hall(self, req_id: str, name: str) -> Optional[UUID]:
        stmt = insert(DiningHalls).values(
            id=uuid4(),
            req_id=req_id,
            name=name
        ).on_conflict_do_nothing(
            index_elements=["req_id"]
        ).returning(DiningHalls.id)

        res = await self.db_session.execute(stmt)
        await self.db_session.flush() 

        return res.scalar_one_or_none()  # Returns the ID of the inserted dining hall or None if it already exists

    async def get_dining_hall_by_name(self, name: str) -> Optional[DiningHalls]:
        stmt = select(DiningHalls).where(DiningHalls.name == name)
        res = await self.db_session.execute(stmt)
        entry = res.scalar_one_or_none()
        if entry:
            return entry
        return None

    async def get_dining_halls(self) -> list[DiningHallSummary]:
        stmt = select(DiningHalls).order_by(DiningHalls.name.asc())
        res = await self.db_session.execute(stmt)

        entries = res.scalars().all()
        return [
            DiningHallSummary(id=entry.id, name=entry.name) for entry in entries
        ]
