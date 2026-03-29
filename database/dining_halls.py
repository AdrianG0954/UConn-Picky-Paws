from uuid import UUID, uuid4

from database.base import Base
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TEXT
from sqlalchemy.orm import Mapped, mapped_column

class DiningHalls(Base):
    __tablename__ = "dining_halls"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(TEXT, unique=True, nullable=False)
