import asyncio
from datetime import date, timedelta
from typing import Any, Optional

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


def _hall_name_from_enum(hall_info: DiningHallEnum) -> str:
    return hall_info.name.lower().replace("_", " ")


def _format_menu_date(day: date) -> str:
    return day.strftime("%m/%d/%Y")


def _normalize_food_name(name: str) -> str:
    return " ".join(name.casefold().split())


def _get_current_week_start(today: Optional[date] = None) -> date:
    current_day = today or date.today()
    days_since_sunday = (current_day.weekday() + 1) % 7
    return current_day - timedelta(days=days_since_sunday)


def _get_current_week_dates(today: Optional[date] = None) -> list[date]:
    week_start = _get_current_week_start(today)
    return [week_start + timedelta(days=offset) for offset in range(7)]


async def _fetch_week_menus(
    parse_dishes_service: ParseDishes,
    hall_info: DiningHallEnum,
    week_dates: list[date],
) -> list[dict[str, Any]]:
    return await asyncio.gather(
        *[
            parse_dishes_service.get_dining_hall_menu(hall_info, _format_menu_date(day))
            for day in week_dates
        ]
    )


def _get_meal_availabilities(
    food_item: str,
    hall_info: DiningHallEnum,
    week_dates: list[date],
    menus: list[dict[str, Any]],
) -> list[DayAvailability]:
    normalized_food_item = _normalize_food_name(food_item)
    hall_name = _hall_name_from_enum(hall_info)
    days: list[DayAvailability] = []

    for day, menu in zip(week_dates, menus):
        availabilities: list[AvailabilityEntry] = []
        dishes = menu.get("dishes", {})

        for meal_name in ("breakfast", "lunch", "dinner"):
            meal_items = dishes.get(meal_name, [])
            if any(_normalize_food_name(item) == normalized_food_item for item in meal_items):
                availabilities.append(
                    AvailabilityEntry(meal=meal_name, dining_hall=hall_name)
                )

        days.append(DayAvailability(date=day.isoformat(), availabilities=availabilities))

    return days


async def get_food_availability(
    food_item: str,
    hall_name: str,
) -> FoodAvailabilityResponse:
    try:
        hall_info = DiningHallEnum[hall_name.upper().replace(" ", "_")]
    except KeyError as exc:
        raise ValueError(f"Dining hall '{hall_name}' not found") from exc

    week_dates = _get_current_week_dates()
    parse_dishes_service = ParseDishes()
    menus = await _fetch_week_menus(parse_dishes_service, hall_info, week_dates)

    return FoodAvailabilityResponse(
        food_item=food_item,
        week_start=week_dates[0].isoformat(),
        week_end=week_dates[-1].isoformat(),
        days=_get_meal_availabilities(food_item, hall_info, week_dates, menus),
    )
