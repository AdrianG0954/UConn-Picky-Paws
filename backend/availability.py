import asyncio
from datetime import date, timedelta
from typing import Dict, Optional

from backend.parse_dishes import DiningHallEnum, ParseDishes
from pydantic import BaseModel

class AvailabilityEntry(BaseModel):
    meal: str
    dining_hall: str


class DayAvailability(BaseModel):
    date: str
    availabilities: list[AvailabilityEntry]


class FoodAvailabilityResponse(BaseModel):
    food_item: str
    week_start: str
    week_end: str
    days: list[DayAvailability]




_availability_cache_lock = asyncio.Lock()
_availability_fetch_sem = asyncio.Semaphore(4)
_menu_cache: dict[tuple[str, str], Dict] = {}
_menu_cache_day: Optional[date] = None


def _hall_name_from_enum(hall_info: DiningHallEnum) -> str:
    return hall_info.name.lower().replace("_", " ")


def _format_menu_date(day: date) -> str:
    return day.strftime("%m/%d/%Y")


def _normalize_food_name(name: str) -> str:
    return " ".join(name.casefold().split())


def _get_current_week_dates(today: Optional[date] = None) -> list[date]:
    current_day = today or date.today()
    days_since_sunday = (current_day.weekday() + 1) % 7
    week_start = current_day - timedelta(days=days_since_sunday)
    return [week_start + timedelta(days=offset) for offset in range(7)]


def _reset_cache_if_stale() -> None:
    global _menu_cache_day

    today = date.today()
    if _menu_cache_day != today:
        _menu_cache.clear()
        _menu_cache_day = today


def _get_cached_menu(hall_name: str, dtdate: str) -> Optional[Dict]:
    _reset_cache_if_stale()
    return _menu_cache.get((hall_name, dtdate))


async def _fetch_and_cache_menu(
    parse_dishes_service: ParseDishes,
    hall_info: DiningHallEnum,
    dtdate: str,
) -> None:
    hall_name = _hall_name_from_enum(hall_info)

    if _get_cached_menu(hall_name, dtdate) is not None:
        return

    async with _availability_fetch_sem:
        menu = await parse_dishes_service.get_dining_hall_menu(hall_info, dtdate)

    async with _availability_cache_lock:
        _reset_cache_if_stale()
        if _get_cached_menu(hall_name, dtdate) is None:
            _menu_cache[(hall_name, dtdate)] = menu


async def _warm_current_week_menu_cache(
    parse_dishes_service: ParseDishes,
    week_dates: list[date],
) -> None:
    missing_pairs = [
        (hall_info, _format_menu_date(day))
        for day in week_dates
        for hall_info in DiningHallEnum
        if _get_cached_menu(_hall_name_from_enum(hall_info), _format_menu_date(day)) is None
    ]
    if not missing_pairs:
        return

    async with _availability_cache_lock:
        _reset_cache_if_stale()
        missing_pairs = [
            (hall_info, dtdate)
            for hall_info, dtdate in missing_pairs
            if _get_cached_menu(_hall_name_from_enum(hall_info), dtdate) is None
        ]
        if not missing_pairs:
            return

    await asyncio.gather(
        *[
            _fetch_and_cache_menu(parse_dishes_service, hall_info, dtdate)
            for hall_info, dtdate in missing_pairs
        ]
    )


def _get_meal_availabilities(food_item: str, week_dates: list[date]) -> list[DayAvailability]:
    normalized_food_item = _normalize_food_name(food_item)
    days: list[DayAvailability] = []

    for day in week_dates:
        dtdate = _format_menu_date(day)
        availabilities: list[AvailabilityEntry] = []

        for hall_info in DiningHallEnum:
            hall_name = _hall_name_from_enum(hall_info)
            menu = _get_cached_menu(hall_name, dtdate) or {"dishes": {}}
            dishes = menu.get("dishes", {})

            for meal_name in ("breakfast", "lunch", "dinner"):
                meal_items = dishes.get(meal_name, [])
                if any(_normalize_food_name(item) == normalized_food_item for item in meal_items):
                    availabilities.append(
                        AvailabilityEntry(meal=meal_name, dining_hall=hall_name)
                    )

        days.append(DayAvailability(date=day.isoformat(), availabilities=availabilities))

    return days


async def get_food_availability(food_item: str) -> FoodAvailabilityResponse:
    week_dates = _get_current_week_dates()
    parse_dishes_service = ParseDishes()

    await _warm_current_week_menu_cache(parse_dishes_service, week_dates)

    return FoodAvailabilityResponse(
        food_item=food_item,
        week_start=week_dates[0].isoformat(),
        week_end=week_dates[-1].isoformat(),
        days=_get_meal_availabilities(food_item, week_dates),
    )
