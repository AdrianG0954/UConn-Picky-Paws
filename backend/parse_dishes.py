# pyright: reportOptionalMemberAccess=false

from enum import Enum
from typing import Dict, Optional
from itertools import batched

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from bs4 import BeautifulSoup

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

    async def get_dining_hall_menu_with_nutritional_info(self, hall_info: DiningHallEnum, dtdate: Optional[str]):
        hall_id = hall_info.value
        meals = ["Breakfast", "Lunch", "Dinner"]
        
        food_items: Dict = {}
        for meal in meals:
            try:
                params = {
                    "sName": "UCONN Dining Services",
                    "locationNum": hall_id,
                    "naFlag": "1",
                    "mealName": meal
                }
                if dtdate:
                    params["dtdate"] = dtdate
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        "https://nutritionanalysis.dds.uconn.edu/longmenu.aspx",
                        params=params,
                        timeout=10.0
                    )
                    response.raise_for_status()  # Raise an exception for HTTP errors
                    
            except httpx.HTTPError as e:
                logger.error(f"Error fetching dining hall {meal} menu for hall_id {hall_id}: {e}")
                continue
            meal_items = await self.get_and_parse_meal_items(response.text)

            food_items[meal] = meal_items
        
        return {
            "dishes": food_items
        }
    

    async def get_and_parse_meal_items(self, html: str):
        resp = []
        if not html: return resp
        
        items = [line.strip() for line in html.splitlines() if "longmenucoldispname" in line]
        for i in items:
            try:
                url = f"https://nutritionanalysis.dds.uconn.edu/" + i.split("'", 8)[7]
                async with httpx.AsyncClient() as client:
                    response = await client.get(url=url)
                    response.raise_for_status()  # Raise an exception for HTTP errors

            except httpx.HTTPError:
                return resp
            
            parsed = self.parse_meal_item(response.text)

            if parsed['name'] == "Unknown": continue # We do not want Unknowns in our DB

            resp.append(parsed)
                
        return resp
                

    def parse_meal_item(self, html: str):
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

        replace_with_coconut = "Our bakery uses coconut (a tree nut)." # this is stupid, just say COCONUT UCONN!!!!!!
        item: Dict = {}
        if not html: return item

        soup = BeautifulSoup(html, 'html.parser')

        # invalid item; happens when dining halls have a "Manager's Choice" option
        if soup.find(class_="labelnotavailable") is not None:
            return {"name": "Unknown", "nutrition_facts": {}}

        item["name"] = soup.find(class_="labelrecipe").get_text()
        item["nutrition_facts"] = {}
        item["nutrition_facts"]["serving_size"] = soup.find_all(class_="nutfactsservsize")[1].get_text().lower()
        item["nutrition_facts"]["calories"] = int(soup.find(class_="nutfactscaloriesval").get_text())
        item["nutrition_facts"]["allergens"] = soup.find(class_="labelallergensvalue").get_text().replace(replace_with_coconut, "Coconut").split(', ')

        nutrients = soup.find_all(class_="nutfactstopnutrient")
        for nutrient, daily_value in batched(nutrients, 2):
            template: dict = {}
            n: str = f"{nutrient.get_text()}".strip("\xa0")
            d: str = daily_value.get_text(strip=True)
            n_normal: str = normalize_nutrient(n)

            grams = n.split()[1] if "Added Sugars" in n else n.split()[-1]

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
                "locationName": hall_name, # NOTE: this param is meaningless; themenu is dependent on locationNum
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
