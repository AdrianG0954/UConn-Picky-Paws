import asyncio
from datetime import datetime, timedelta

from sqlalchemy import update, delete
from sqlalchemy.dialects.postgresql import insert

from backend.server import _db_session_maker, logger
from backend.parse_dishes import DiningHallEnum, ParseDishes
from database.dishes import Dishes
from backend.repository.dining_hall_repository import DiningHallRepository

# limit of hall info requests at a time to not overload the network
_populate_hall_sem = asyncio.Semaphore(2)


async def populate_db():
    """
    This function populates the dining_halls table with all 
    tables within the DiningHall Enum. It then makes requests to the 
    nutrition api for all days of the week and only updates the database
    with the latest unique menu items.
    """
    parse_dishes_service = ParseDishes()

    async def fetch_and_update(hall: DiningHallEnum) -> None:
        """
        Fetches the menu for the given dining hall and updates the database with the latest unique menu items.
        """
        async with _db_session_maker() as db_session:
            dining_hall_repo = DiningHallRepository(db_session)

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
            today = datetime.now().date()
            dishes_dict = {}

            # sequentially fetch the menu to ease the load on the network
            for i in range(7):
                dtdate = (today + timedelta(days=i)).strftime("%m/%d/%Y")
                resp = await parse_dishes_service.get_dining_hall_menu_with_nutritional_info(hall, dtdate=dtdate)

                for meal_type in resp["dishes"]:
                    for dish in resp["dishes"][meal_type]:
                        # ensure duplicates are not stored
                        dish_key = dish['name']
                        if dish_key not in dishes_dict:
                            dishes_dict[dish_key] = {
                                "dining_hall_id": dining_hall_id,
                                "name": dish['name'],
                                "nutrition_info": dish['nutrition_facts'],
                                "elo_rating": 1000.0,  # default elo rating
                            }

            dishes_to_insert = list(dishes_dict.values())

            # Batch insert all dishes at once
            if dishes_to_insert:
                now = datetime.now()
                stmt = insert(Dishes).values(dishes_to_insert).on_conflict_do_update(
                    index_elements=["dining_hall_id", "name"],
                    set_={
                        "active": True,
                        "last_seen": now,
                    }
                )
                await db_session.execute(stmt)

            await db_session.commit()

    async def fetch_and_update_bounded(hall: DiningHallEnum) -> None:
        # make sure we can only fetch the info for 2 dining halls at a time
        async with _populate_hall_sem:
            await fetch_and_update(hall)

    tasks = [fetch_and_update_bounded(hall) for hall in DiningHallEnum]
    errs = await asyncio.gather(*tasks, return_exceptions=True)
    for err in errs:
        if isinstance(err, Exception):
            logger.exception(f"Error occurred during populate_db", exc_info=err)

async def mark_old_dishes_inactive():
    """
    This marks dishes that have not been seen for the last 4 months (~17 weeks) as inactive.
    We dont delete them in case they are seen again (to preserve their elo).
    """
    async with _db_session_maker() as db_session:
        four_months_ago = datetime.now() - timedelta(weeks=17)
        stmt = (
            update(Dishes)
            .where((Dishes.last_seen < four_months_ago) & (Dishes.active == True))
            .values(active=False)
        )
        await db_session.execute(stmt)
        await db_session.commit()


async def delete_inactive_dishes():
    """
    This deletes dishes that have been inactive for 8 months (~34 weeks).
    """
    async with _db_session_maker() as db_session:
        eight_months_ago = datetime.now() - timedelta(weeks=34)
        stmt = (
            delete(Dishes)
            .where((Dishes.last_seen < eight_months_ago) & (Dishes.active == False))
        )
        await db_session.execute(stmt)
        await db_session.commit()

async def main():
    """Main entry point for running the script."""
    await populate_db()
    await delete_inactive_dishes()
    await mark_old_dishes_inactive()

if __name__ == "__main__":
    asyncio.run(main())