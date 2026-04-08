import asyncio

from sqlalchemy.dialects.postgresql import insert

from backend.server import _db_session_maker
from backend.parse_dishes import DiningHallEnum, ParseDishes
from database.dishes import Dishes
from backend.repository.dining_hall_repository import DiningHallRepository

async def populate_db():
    """
    This function populates the dining_halls table with all 
    tables within the DiningHall Enum. It then makes requests to the 
    nutrition api for all days of the week and only updates the database
    with the latest unique menu items.
    """

    async def fetch_and_update(hall: DiningHallEnum):
        async with _db_session_maker() as db_session:
            dining_hall_repo = DiningHallRepository(db_session)
            parse_dishes_service = ParseDishes()

            normalized_name = hall.name.lower().replace("_", " ")
            dining_hall_id = await dining_hall_repo.add_dining_hall(req_id=hall.value, name=normalized_name)

            if dining_hall_id is None:
                entry = await dining_hall_repo.get_dining_hall_by_name(normalized_name)
                if entry is None:
                    raise ValueError(f"Dining hall '{normalized_name}' not found")
                dining_hall_id = entry.id

            # Flush to persist dining hall before making HTTP request
            await db_session.flush()

            # we need to change to do this for the rest of the week as well
            resp = await parse_dishes_service.get_dining_hall_menu_with_nutritional_info(hall, dtdate=None)
            
            # Collect all dishes to insert
            dishes_to_insert = []
            for meal_type in resp["dishes"]:
                for dish in resp["dishes"][meal_type]:
                    dishes_to_insert.append({
                        "dining_hall_id": dining_hall_id,
                        "name": dish['name'],
                        "nutrition_info": dish['nutrition_facts'],
                        "elo_rating": 1000.0,  # default elo rating
                    })
            
            # Batch insert all dishes at once
            if dishes_to_insert:
                stmt = insert(Dishes).values(dishes_to_insert).on_conflict_do_nothing(
                    index_elements=["dining_hall_id", "name"]
                )
                await db_session.execute(stmt)

            await db_session.commit()
    tasks = [fetch_and_update(hall) for hall in DiningHallEnum]
    errs = await asyncio.gather(*tasks, return_exceptions=True)
    for err in errs:
        if isinstance(err, Exception):
            print(f"Error occurred: {err}")


async def main():
    """Main entry point for running the script."""
    await populate_db()
                    
if __name__ == "__main__":
    asyncio.run(main())