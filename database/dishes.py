from uuid import UUID

from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TEXT, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.dining_halls import DiningHalls

class Dishes(Base):
    __tablename__ = "dishes"
    __table_args__ = (
        Index("ix_dishes_elo_rating", "elo_rating"),
        Index(
            "ix_dishes_dining_hall_id_elo_rating",
            "dining_hall_id",
            "elo_rating",
        ),
        Index(
            "ix_dishes_matches",
            "matches",
        )
    )

    # Primary key is composite of: (dining_hall_id, name)
    dining_hall_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey(DiningHalls.id, ondelete="CASCADE"), primary_key=True, nullable=False)
    name: Mapped[str] = mapped_column(TEXT, primary_key=True, nullable=False)
    nutrition_info: Mapped[dict] = mapped_column(JSONB, nullable=False)
    elo_rating: Mapped[float] = mapped_column(nullable=False, server_default=text("1000.0"))
    matches: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    # k: Mapped[float] = mapped_column(nullable=False, server_default=text("30.0"))
