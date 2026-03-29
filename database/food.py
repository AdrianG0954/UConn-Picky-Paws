from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TEXT, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.dining_halls import DiningHalls

class Food(Base):
    __tablename__ = "food"

    dining_hall_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey(DiningHalls.id, ondelete="CASCADE"), primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(TEXT, primary_key=True, nullable=False)
    nutrition_info: Mapped[dict] = mapped_column(JSONB, nullable=False)
    elo_rating: Mapped[float] = mapped_column(nullable=False, server_default=text("1000.0"))
