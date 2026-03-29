from uuid import UUID, uuid4

from database.base import Base
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TEXT
from sqlalchemy import text
from sqlalchemy.orm import Mapped, mapped_column

class DiningHalls(Base):
    __tablename__ = "dining_halls"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(TEXT, unique=True, nullable=False)
