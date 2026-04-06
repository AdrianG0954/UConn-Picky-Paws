import asyncio
import json

from sqlalchemy.ext.asyncio import AsyncSession

from backend.server import _db_session_maker
from backend.parse_dishes import DiningHallEnum, ParseDishes
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
        normalized_name = hall.name.lower().replace("_", " ")
        dining_hall_id = await dining_hall_repo.add_dining_hall(req_id=hall.value, name=normalized_name)
        if dining_hall_id is None:
            # fetch existing dining hall id
            entry = await dining_hall_repo.get_dining_hall_by_name(normalized_name)
            if entry is None:
                raise ValueError(f"Dining hall '{normalized_name}' not found")
            dining_hall_id = entry.id

        # Make requests to the nutrition api for all days of the week
        # (testing so im doing today only)
        # TODO: Optimize lookups to avoid N + 1 queries 
        resp = await parse_dishes_service.get_dining_hall_menu_with_nutritional_info(hall, dtdate=None) 
        for meal_type in resp["dishes"]:
            for dish in resp["dishes"][meal_type]:
                dish_entry = Dishes(
                    dining_hall_id=dining_hall_id,
                    name=dish['name'],
                    meal_type=meal_type,
                    nutrition_info=dish['nutrition_facts'],
                    elo_rating=1000.0, # default elo rating
                )

                entry = await db_session.get(Dishes, (dining_hall_id, dish['name']))

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