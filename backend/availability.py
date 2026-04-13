import asyncio
from datetime import date, timedelta
from typing import Any, Dict, List, Set, Tuple

from backend.parse_dishes import DiningHallEnum, ParseDishes
from pydantic import BaseModel


class AvailabilityEntry(BaseModel):
    meal: str
    dining_hall: str


class DayAvailability(BaseModel):
    date: str
    availabilities: List[AvailabilityEntry]


class DishAvailabilityResponse(BaseModel):
    dish_name: str
    week_start: str
    week_end: str
    days: List[DayAvailability]


# Limit concurrent requests to ease load on the API
_availability_fetch_sem = asyncio.Semaphore(35)


def _get_current_week_dates() -> List[date]:
    """
    Gets the current week's dates (Sunday to Saturday).
    """
    current_day = date.today()
    days_since_sunday = (current_day.weekday() + 1) % 7
    week_start = current_day - timedelta(days=days_since_sunday)
    return [week_start + timedelta(days=offset) for offset in range(7)]


async def get_dish_availability(
    dish_name: str,
    hall_info: DiningHallEnum,
) -> DishAvailabilityResponse:
    """
    Checks if a given dish is available in the dining hall for the week.
    """
    week_dates = _get_current_week_dates()
    parse_dishes_service = ParseDishes()

    async def fetch_menu(day: date) -> Tuple[str, Dict[str, Any]]:
        """Concurrently fetches menu for specific day."""
        dtdate = day.strftime("%m/%d/%Y")
        async with _availability_fetch_sem:
            menu = await parse_dishes_service.get_dining_hall_menu(hall_info, dtdate)
        return dtdate, menu

    # Fetch menus for the entire week
    menu_results = await asyncio.gather(*[fetch_menu(day) for day in week_dates])
    menus = dict(menu_results)

    return DishAvailabilityResponse(
        dish_name=dish_name,
        week_start=week_dates[0].isoformat(),
        week_end=week_dates[-1].isoformat(),
        days=_get_meal_availabilities(dish_name, hall_info, menus, week_dates),
    )


def _get_meal_availabilities(
    dish_name: str,
    hall_info: DiningHallEnum,
    menus: Dict[str, Dict],
    week_dates: List[date],
) -> List[DayAvailability]:
    """
    Checks if a given dish is available in the dining hall for the week.
    """
    hall_name = hall_info.name.lower().replace("_", " ")
    days_available: List[DayAvailability] = []

    # Iterate over each day in the week
    for day in week_dates:
        dtdate = day.strftime("%m/%d/%Y")
        availabilities: List[AvailabilityEntry] = []

        menu = menus.get(dtdate, {"dishes": {}})
        dishes = menu.get("dishes", {})

        # check if food item is available in any meal for the day
        for meal_name in ("breakfast", "lunch", "dinner"):
            meal_items: Set[str] = dishes.get(meal_name, set())
            if dish_name in meal_items:
                availabilities.append(
                    AvailabilityEntry(
                        meal=meal_name,
                        dining_hall=hall_name,
                    )
                )

        days_available.append(
            DayAvailability(
                date=day.isoformat(),
                availabilities=availabilities,
            )
        )

    return days_available
