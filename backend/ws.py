from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect

FoodKey = tuple[UUID, str]


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.subscriptions: dict[FoodKey, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        # Cleanup foods unsubscribed client was subscribed to
        empty_keys: list[FoodKey] = []
        for food_key, subscribers in self.subscriptions.items():
            subscribers.discard(websocket)
            if not subscribers:
                empty_keys.append(food_key)

        for food_key in empty_keys:
            del self.subscriptions[food_key]

    def subscribe(self, websocket: WebSocket, foods: list[dict]) -> list[dict]:
        subscribed_foods: list[dict] = []

        for food in foods:
            dining_hall_id = UUID(food["dining_hall_id"])
            name = food["name"].strip()
            food_key = (dining_hall_id, name)
            self.subscriptions[food_key].add(websocket)
            subscribed_foods.append(
                {
                    "dining_hall_id": str(dining_hall_id),
                    "name": name,
                }
            )

        return subscribed_foods

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    async def publish_food_update(self, dining_hall_id: UUID, name: str, payload: dict):
        food_key = (dining_hall_id, name)
        failed_websockets: list[WebSocket] = []

        for websocket in set(self.subscriptions.get(food_key, set())):
            try:
                await websocket.send_json(
                    {
                        "type": "food_elo_update",
                        "food": payload,
                    }
                )
            except (RuntimeError, WebSocketDisconnect):
                failed_websockets.append(websocket)

        for websocket in failed_websockets:
            self.disconnect(websocket)

# Cleans up and validates food subscriptions
def _validate_food_list(message: dict) -> list[dict]:
    foods = message.get("foods")
    if not isinstance(foods, list) or not foods:
        raise ValueError("'foods' must be a non-empty array")

    normalized_foods: list[dict] = []
    for food in foods:
        if not isinstance(food, dict):
            raise ValueError("Each item in 'foods' must be an object")

        dining_hall_id = food.get("dining_hall_id")
        name = food.get("name")

        if not isinstance(dining_hall_id, str) or not dining_hall_id.strip():
            raise ValueError("Each food must include a non-empty 'dining_hall_id'")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Each food must include a non-empty 'name'")

        normalized_foods.append(
            {
                "dining_hall_id": dining_hall_id,
                "name": name,
            }
        )

    return normalized_foods


async def handle_leaderboard_websocket(
    websocket: WebSocket,
    client_id: int,
    manager: ConnectionManager,
):
    await manager.connect(websocket)
    try:
        while True:
            try:
                message = await websocket.receive_json()
                message_type = message.get("type")

                match message_type:
                    case "subscribe":
                        foods = _validate_food_list(message)
                        subscribed_foods = manager.subscribe(websocket, foods)
                        await manager.send_personal_message(
                            {
                                "type": "subscribed",
                                "client_id": client_id,
                                "foods": subscribed_foods,
                            },
                            websocket,
                        )
                    # case "unsubscribe"
                    case _:
                        await manager.send_personal_message(
                            {
                                "type": "error",
                                "message": "Unsupported message type. Use 'subscribe'.",
                            },
                            websocket,
                        )
            except ValueError as exc:
                await manager.send_personal_message(
                    {
                        "type": "error",
                        "message": str(exc),
                    },
                    websocket,
                )
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)
