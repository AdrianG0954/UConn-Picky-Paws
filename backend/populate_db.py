from uuid import uuid4
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from backend.server import _db_session_maker
from backend.parse_dishes import DiningHallEnum, ParseDishes
from database.dining_halls import DiningHalls
from database.dishes import Dishes
from backend.repository.dining_hall_repository import DiningHallRepository

async def populate_db(db_session: AsyncSession):
    """
    This function populates the dining_halls table with all 
    tables within the DiningHall Enum. It then makes requests to the 
    nutrition api for all days of the week and only updates the database
    with the latest unique menu items.
    """
    dining_hall_repo = DiningHallRepository(db_session)
    parse_dishes_service = ParseDishes(db_session)

    for hall in DiningHallEnum:
        hall_entry = DiningHalls(
            id=uuid4(),
            req_id=hall.value, # id uconn uses to distinguish dining halls
            name=hall.name.lower().replace("_", " ") # inserting normalized name
        )
        dining_hall_id = await dining_hall_repo.add_dining_hall(hall_entry)

        # Make requests to the nutrition API for all days of the week
        # (currently limited to today for testing)
        resp = await parse_dishes_service.get_dining_hall_menu(hall, dtdate=None) 

        for meal_type in resp["dishes"]:
            for dish in resp["dishes"][meal_type]:
                dish_entry = Dishes(
                    dining_hall_id=dining_hall_id,
                    name=dish,
                    meal_type=meal_type,
                    nutrition_info={}, # TODO: populate this with actual nutrition info
                    elo_rating=1000.0, # default elo rating
                ) 

                entry = await db_session.get(Dishes, (dining_hall_id, dish, meal_type))
                if not entry:
                    db_session.add(dish_entry)
    
    # Commit all changes
    await db_session.commit()

async def main():
    """Main entry point for running the script."""
    async with _db_session_maker() as db_session:
        await populate_db(db_session)
                    
if __name__ == "__main__":
    asyncio.run(main())