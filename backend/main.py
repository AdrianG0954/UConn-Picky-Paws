import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import FastAPI, Depends
from fastapi.exceptions import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession

from backend.calculate_elo import EloBody, CalculateElo

load_dotenv()  # Load environment variables from .env file

app = FastAPI()

# per-request database session
_engine = create_async_engine(os.getenv("ASYNC_DATABASE_URL"))
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

@app.get("/")
def read_root():
    return {"message": "Hello, world"}


@app.get("/health")
def health():
	return {"status": "ok"}


@app.patch("/meals/elo", status_code=200)
async def update_elo(
    request: EloBody,
    db_session: Annotated[AsyncSession, Depends(request_db_session)]
):
	try:
		await CalculateElo(db_session=db_session).calculate_elo(request=request)
	except ValueError as ve:
		raise HTTPException(status_code=400, detail=str(ve))
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))	
