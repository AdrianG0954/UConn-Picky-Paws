import os
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from fastapi.security import HTTPBearer
from backend.ws import ConnectionManager

load_dotenv()

CAS_BASE = "https://login.uconn.edu/cas"
# service URL should be our frontend URL
SERVICE_URL = os.getenv("SERVICE_URL", "http://localhost:5173/callback")
CAS_NS = {"cas": "http://www.yale.edu/tp/cas"}
security = HTTPBearer()

logger = logging.getLogger(__name__)
# Configure logger to only show warnings and above.
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI()
app.state.connection_manager = ConnectionManager()

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://picky-paws.com",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://([a-z0-9-]+\.)*up\.railway\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# creates a pool of 15 connections + 15 overflow connections = 30 connections MAX
_engine = create_async_engine(
    url=os.getenv("ASYNC_DATABASE_URL", ""),
    pool_size=15,
    max_overflow=15,
    pool_pre_ping=True,
)

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

