import asyncio
from enum import Enum
from typing import Dict, Optional, Any
from itertools import batched

import httpx
from bs4 import BeautifulSoup

from backend.server import logger

# global limit to concurrent requests (to not overload the network)
_nutrition_http_sem = asyncio.Semaphore(10)


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

    async def get_dining_hall_menu_with_nutritional_info(self, hall_info: DiningHallEnum, dtdate: Optional[str]) -> Dict[str, Any]:
        """
        Fetches the menu and nutritional information for the given dining hall and date.
        """
        hall_id = hall_info.value
        meal_types = ["Breakfast", "Lunch", "Dinner"]
        food_items = {}

        # define the limits for this halls menu requests 
        limits = httpx.Limits(max_connections=50, max_keepalive_connections=20)
        timeout = httpx.Timeout(60.0)
        async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:

            async def fetch_hall_menu(meal_type: str) -> None:
                """
                makes the request to get the menu for the given meal type
                """
                params = {
                    "sName": "UCONN Dining Services",
                    "locationNum": hall_id,
                    "naFlag": "1",
                    "mealName": meal_type,
                }
                if dtdate:
                    params["dtdate"] = dtdate

                try:
                    async with _nutrition_http_sem:
                        response = await client.get(
                            "https://nutritionanalysis.dds.uconn.edu/longmenu.aspx",
                            params=params,
                        )
                    response.raise_for_status()

                    # pass client to be used in the fetch_nutritional_info_and_parse function
                    meal_items = await self.fetch_nutritional_info_and_parse(response.text, client)
                    food_items[meal_type] = meal_items
                except Exception as e:
                    logger.warning(f"Error fetching {meal_type}: {type(e).__name__}")

            tasks = [fetch_hall_menu(meal_type) for meal_type in meal_types]
            await asyncio.gather(*tasks, return_exceptions=True)

        return {
            "dishes": food_items
        }

    async def fetch_nutritional_info_and_parse(self, html: str, client: httpx.AsyncClient) -> list[Dict[str, Any]]:
        """
        fetches the nutritional information for each dish in the menu
        """
        resp = []
        if not html:
            return resp

        async def fetch_nutrition_info(dish: str) -> Optional[Dict[str, Any]]:
            """
            fetches the nutritional information for the given dish
            """
            dish = dish.split("'", 8)[7].strip()
            url = f"https://nutritionanalysis.dds.uconn.edu/" + dish
            try:
                async with _nutrition_http_sem:
                    response = await client.get(url=url)
                response.raise_for_status()

                parsed = self.parse_meal_item(response.text)
            except Exception as e:
                logger.warning(f"Error fetching {url}: {type(e).__name__}")
                return None

            return parsed if parsed["name"] != "Unknown" else None

        items = [line.strip() for line in html.splitlines() if "longmenucoldispname" in line]
        tasks = [fetch_nutrition_info(item) for item in items]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, dict):
                resp.append(result)

        return resp
                

    def parse_meal_item(self, html: str) -> Dict[str, Any]:
        """
        returns a dict of the format:
        {
            "name": dish
            "nutrition_facts": {
                "serving_size": serving_size,
                "calories": calories,
                "allergens": [allergens]
                "nutrients": [
                    {}                
                ]
            }
        }
        """

        def has_grams(g: str) -> bool:
            """
            from stackoverflow; handles the case where the html does not contain digits for amount
            - "Vitamin D - mcg mcg" returns false
            """
            return any(char.isdigit() for char in g)
        
        def normalize_nutrient(n: str) -> str:
            """
            this is a hack
            """
            tokens = n.split()
            one_normal = f"{tokens[0].lower()}"
            two_normal = f"{tokens[0].lower()}_{tokens[1].lower().strip('.')}"
            one_list = {"cholesterol", "sodium", "protein", "calcium", "iron", "potassium"}
            two_list = {"total_fat", "total_carbohydrate", "saturated_fat", "dietary_fiber", "trans_fat", "total_sugars", "vitamin_d"}
            if one_normal in one_list:
                return one_normal
            elif two_normal in two_list:
                return two_normal
            else:
                return "added_sugars"

        if not html: 
            return {"name": "Unknown", "nutrition_facts": {}}

        replace_with_coconut = "Our bakery uses coconut (a tree nut)." # this is stupid, just say COCONUT UCONN!!!!!!
        item: Dict = {}
        soup = BeautifulSoup(html, 'html.parser')

        # invalid item; happens when dining halls have a "Manager's Choice" option
        if soup.find(class_="labelnotavailable") is not None:
            return {"name": "Unknown", "nutrition_facts": {}}

        name = soup.find(class_="labelrecipe")
        if name is None:
            item["name"] = "Unknown"
        else:
            item["name"] = name.get_text().strip()

        item["nutrition_facts"] = {}
        serving_sizes = soup.find_all(class_="nutfactsservsize")
        item["nutrition_facts"]["serving_size"] = serving_sizes[1].get_text().lower() if len(serving_sizes) > 1 else "Unknown"

        cal_val = soup.find(class_="nutfactscaloriesval")
        item["nutrition_facts"]["calories"] = int(cal_val.get_text()) if cal_val else 0

        allergens = soup.find(class_="labelallergensvalue")
        item["nutrition_facts"]["allergens"] = allergens.get_text().replace(replace_with_coconut, "Coconut").split(', ') if allergens else []

        nutrients = soup.find_all(class_="nutfactstopnutrient")
        for nutrient, daily_value in batched(nutrients, 2):
            template: dict = {}
            n: str = f"{nutrient.get_text()}".strip("\xa0")
            d: str = daily_value.get_text(strip=True)
            n_normal: str = normalize_nutrient(n)

            n_split = n.split()
            if "Added Sugars" in n:
                grams = n_split[1] if len(n_split) > 1 else "0g"
            else:
                grams = n_split[-1] if len(n_split) > 0 else "0g"

            grams_bool = has_grams(grams)
            if "Trans Fat" in n:
                template["amount"] = grams if grams_bool else "0g"
                template["daily_value"] = "0%"
            elif "Vitamin D" in n:
                template["amount"] = grams if grams_bool else "0mcg"
                template["daily_value"] = "0%" if d == "" else d
            elif "Potassium" in n:
                template["amount"] = grams if grams_bool else "0mg"
                template["daily_value"] = "0%" if d == "" else d
            elif "Total Sugars" in n:
                template["amount"] = grams
                template["daily_value"] = f"{round((float(grams.strip('g')) / 50) * 100)}%" if grams_bool else "~%"
            elif "Protein" in n:
                template["amount"] = grams
                template["daily_value"] = f"{round((float(grams.strip('g')) * 0.415) / 50 * 100)}%" if grams_bool else "~%"
            else:
                template["amount"] = grams
                template["daily_value"] = d
            
            item["nutrition_facts"][n_normal] = template

        return item


    async def get_dining_hall_menu(self, hall_info: DiningHallEnum, dtdate: Optional[str]) -> Dict[str, Any]:
        """
        Fetches the dining hall menu. Fetches today's menu if 'dtdate' is not provided.

        NOTE: The 'dtdate' parameter should be in the format 'MM/DD/YYYY'.
        """
        hall_name = hall_info.name.lower().replace("_", " ")
        hall_id = hall_info.value

        limits = httpx.Limits(max_connections=32, max_keepalive_connections=16)
        timeout = httpx.Timeout(60.0)
        try:
            async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
                params = {
                    "sName": "UCONN Dining Services",
                    "locationNum": hall_id,
                    "locationName": hall_name,  # NOTE: meaningless; menu depends on locationNum
                    "naFlag": "1",
                    "myaction": "read",
                }
                if dtdate:
                    params["dtdate"] = dtdate

                async with _nutrition_http_sem:
                    response = await client.get(
                        "https://nutritionanalysis.dds.uconn.edu/shortmenu.aspx",
                        params=params,
                    )
                response.raise_for_status()

        except Exception as e:
            logger.warning(f"Error fetching menu for {hall_name}: {type(e).__name__}")
            return {"dishes": {}}

        food_items = self.parse_food_items(response.text)
        return {
            "dishes": food_items,
        }


    def parse_food_items(self, html: str) -> Dict:
        """
        Parses the food items from the HTML of the dining hall menu.
        """
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
 
