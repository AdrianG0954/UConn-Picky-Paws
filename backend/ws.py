from collections import defaultdict
from typing import Literal, TypeAlias
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.helpers import LeaderboardEntry, get_leaderboard_entries

ScopeKind = Literal["global", "dining_hall"]
LeaderboardScope: TypeAlias = tuple[ScopeKind, UUID | None]


def global_scope() -> LeaderboardScope:
    return ("global", None)


def dining_hall_scope(dining_hall_id: UUID) -> LeaderboardScope:
    return ("dining_hall", dining_hall_id)


class ConnectionManager:
    def __init__(self):
        self.scope_subscriptions: dict[LeaderboardScope, set[WebSocket]] = defaultdict(set)
        self.websocket_scopes: dict[WebSocket, LeaderboardScope] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

    def disconnect(self, websocket: WebSocket):
        previous_scope = self.websocket_scopes.pop(websocket, None)
        if previous_scope is None:
            return

        subscribers = self.scope_subscriptions.get(previous_scope)
        if not subscribers:
            return

        subscribers.discard(websocket)
        if not subscribers:
            del self.scope_subscriptions[previous_scope]

    def subscribe_leaderboard(
        self,
        websocket: WebSocket,
        scope: LeaderboardScope,
    ) -> LeaderboardScope:
        self.disconnect(websocket)
        self.scope_subscriptions[scope].add(websocket)
        self.websocket_scopes[websocket] = scope
        return scope

    def has_subscribers(self, scope: LeaderboardScope) -> bool:
        return bool(self.scope_subscriptions.get(scope))

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def publish_snapshot(
        self,
        scope: LeaderboardScope,
        entries: list[LeaderboardEntry],
    ):
        subscribers = set(self.scope_subscriptions.get(scope, set()))
        if not subscribers:
            return

        message = _build_snapshot_message(scope, entries)
        failed_websockets: list[WebSocket] = []

        for websocket in subscribers:
            try:
                await websocket.send_json(message)
            except (RuntimeError, WebSocketDisconnect):
                failed_websockets.append(websocket)

        for websocket in failed_websockets:
            self.disconnect(websocket)


def _build_snapshot_message(
    scope: LeaderboardScope,
    entries: list[LeaderboardEntry],
) -> dict:
    scope_kind, dining_hall_id = scope
    message: dict[str, object] = {
        "type": "leaderboard_snapshot",
        "scope": scope_kind,
        "entries": [entry.model_dump(mode="json") for entry in entries],
    }
    if scope_kind == "dining_hall" and dining_hall_id is not None:
        message["dining_hall_id"] = str(dining_hall_id)
    return message


def _validate_leaderboard_scope(message: dict) -> LeaderboardScope:
    scope = message.get("scope")
    if scope == "global":
        return global_scope()
    if scope == "dining_hall":
        dining_hall_id = message.get("dining_hall_id")
        if not isinstance(dining_hall_id, str) or not dining_hall_id.strip():
            raise ValueError(
                "A non-empty 'dining_hall_id' is required when scope is 'dining_hall'."
            )
        try:
            return dining_hall_scope(UUID(dining_hall_id))
        except ValueError as exc:
            raise ValueError("'dining_hall_id' must be a valid UUID.") from exc
    raise ValueError("Unsupported scope. Use 'global' or 'dining_hall'.")


async def _get_scope_entries(
    db_session: AsyncSession,
    scope: LeaderboardScope,
) -> list[LeaderboardEntry]:
    scope_kind, dining_hall_id = scope
    if scope_kind == "global":
        return await get_leaderboard_entries(db_session=db_session, limit=10)
    return await get_leaderboard_entries(
        db_session=db_session,
        limit=10,
        dining_hall_id=dining_hall_id,
    )


async def publish_leaderboard_snapshots(
    db_session: AsyncSession,
    manager: ConnectionManager,
    affected_dining_hall_ids: set[UUID],
):
    scopes: list[LeaderboardScope] = [global_scope()]
    scopes.extend(
        dining_hall_scope(dining_hall_id)
        for dining_hall_id in sorted(affected_dining_hall_ids, key=str)
    )

    for scope in scopes:
        if not manager.has_subscribers(scope):
            continue
        entries = await _get_scope_entries(db_session, scope)
        await manager.publish_snapshot(scope, entries)


async def handle_leaderboard_websocket(
    websocket: WebSocket,
    manager: ConnectionManager,
    db_session_maker: async_sessionmaker[AsyncSession],
):
    await manager.connect(websocket)
    try:
        while True:
            try:
                message = await websocket.receive_json()
                message_type = message.get("type")

                if message_type == "subscribe_leaderboard":
                    scope = _validate_leaderboard_scope(message)
                    manager.subscribe_leaderboard(websocket, scope)
                    async with db_session_maker() as db_session:
                        entries = await _get_scope_entries(db_session, scope)
                    await manager.send_personal_message(
                        _build_snapshot_message(scope, entries),
                        websocket,
                    )
                else:
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "message": (
                                "Unsupported message type. Use 'subscribe_leaderboard'."
                            ),
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
        # handle exception but do nothing. just don't care about this in our logs
        pass
    finally:
        manager.disconnect(websocket)
