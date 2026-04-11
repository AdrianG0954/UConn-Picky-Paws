import os
import logging

from fastapi import FastAPI
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.ws import ConnectionManager

load_dotenv()

logger = logging.getLogger(__name__)
# Configure logger to only show warnings and above.
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI()
app.state.connection_manager = ConnectionManager()

# per-request database session
_engine = create_async_engine(os.getenv("ASYNC_DATABASE_URL", ""))
_db_session_maker = async_sessionmaker(bind=_engine, expire_on_commit=False)
async def request_db_session():
    """Provide a transactional scope around a series of operations.""" 
    async with _db_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

