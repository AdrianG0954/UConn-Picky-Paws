from enum import Enum
from typing import Dict, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from backend.server import logger


class DiningHallEnum(Enum):
    CONNECTICUT = "03"
    NORTH = "07"
    PUTNAM = "06"
    NORTHWEST = "15"
    WHITNEY = "01"
    MCMAHON = "05"
    SOUTH = "16"
    TOWERS = "42"


class ParseDishes:
    def __init__(self):
        pass


    async def get_dining_hall_menu(self, hall_info: DiningHallEnum, dtdate: Optional[str]):
        """
        Fetches the dining hall menu. Fetches today's menu if 'dtdate' is not provided.

        NOTE: The 'dtdate' parameter should be in the format 'MM/DD/YYYY'.
        """
        hall_name = hall_info.name.lower().replace("_", " ")
        hall_id = hall_info.value

        try:
            params = {
                "sName": "UCONN Dining Services",
                "locationNum": hall_id,
                "locationName": hall_name,
                "naFlag": "1",
                "myaction": "read"
            }
            if dtdate:
                params["dtdate"] = dtdate
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://nutritionanalysis.dds.uconn.edu/shortmenu.aspx",
                    params=params,
                    timeout=10.0
                )
                response.raise_for_status()  # Raise an exception for HTTP errors

        except httpx.HTTPError as e:
            logger.error(f"Error fetching dining hall menu for hall_id {hall_id}: {e}")
            return {"dishes": {}}

        food_items = self.parse_food_items(response.text)

        return {
            "dishes": food_items,
        }


    def parse_food_items(self, html: str) -> Dict:
        resp: Dict = {}
        if not html:
            return resp

        breakfast = "<div class=\"shortmenumeals\">Breakfast</div>"
        lunch = "<div class=\"shortmenumeals\">Lunch</div>"
        dinner = "<div class=\"shortmenumeals\">Dinner</div>"

        components = html.split(breakfast)[1:]
        breakfast_items = []
        for component in components: 
            item = "<div class='shortmenurecipes'>"
            component = component.split(item)
            for c in component: 
                name = c.split("&nbsp;", 1)[0].strip().split(">")[-1]
                if name:
                    breakfast_items.append(name)
                if lunch in c:
                    break # we have all breakfast items
        resp["breakfast"] = breakfast_items

        lunch_items = []
        components = html.split(lunch)[1:]
        for component in components:
            item = "<div class='shortmenurecipes'>"
            component = component.split(item)
            for c in component:
                name = c.split("&nbsp;", 1)[0].strip().split(">")[-1]
                if name:
                    lunch_items.append(name)
                if dinner in c:
                    break  # we have all lunch items
        resp["lunch"] = lunch_items

        dinner_items = []
        components = html.split(dinner)[1:]
        for component in components:
            item = "<div class='shortmenurecipes'>"
            component = component.split(item)
            for c in component:
                name = c.split("&nbsp;", 1)[0].strip().split(">")[-1]
                if name:
                    dinner_items.append(name)
        resp["dinner"] = dinner_items

        return resp
