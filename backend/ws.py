import asyncio
from collections import defaultdict
from typing import Literal, TypeAlias, Optional, Tuple, Set, Dict, List
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.helpers import LeaderboardEntry, get_leaderboard_entries


ScopeKind = Literal["global", "dining_hall"]
LeaderboardScope: TypeAlias = Tuple[ScopeKind, Optional[UUID]]


def global_scope() -> LeaderboardScope:
    return ("global", None)


def dining_hall_scope(dining_hall_id: UUID) -> LeaderboardScope:
    return ("dining_hall", dining_hall_id)


class ConnectionManager:
    def __init__(self):
        # Keeps track of scopes and their subscribers
        self.scope_subscriptions: Dict[LeaderboardScope, Set[WebSocket]] = defaultdict(set)
        # keeps track of a sockets current scope
        self.websocket_scopes: Dict[WebSocket, LeaderboardScope] = {}


    async def connect(self, websocket: WebSocket) -> None:
        # Safe to call even if the route already accepted.
        if websocket.application_state != WebSocketState.CONNECTED:
            await websocket.accept()


    def disconnect(self, websocket: WebSocket) -> None:
        """
        Disconnect a WebSocket from the connection manager.
        """
        # gets the previous scope for a socket (can be none if first time connecting)
        previous_scope = self.websocket_scopes.pop(websocket, None)
        if previous_scope is None:
            return

        subscribers = self.scope_subscriptions.get(previous_scope)
        if not subscribers:
            return

        # remove the socket from this scope's subscribers set
        subscribers.discard(websocket)
        if not subscribers:
            del self.scope_subscriptions[previous_scope]


    def subscribe_leaderboard(
        self,
        websocket: WebSocket,
        scope: LeaderboardScope,
    ) -> LeaderboardScope:
        """
        Subscribe a WebSocket to a specific leaderboard scope.
        """
        # disconnect from the previous scope (if applicable)
        self.disconnect(websocket)

        # adds socket to scope subscribers and keeps track of its current scope
        self.scope_subscriptions[scope].add(websocket)
        self.websocket_scopes[websocket] = scope
        return scope


    def has_subscribers(self, scope: LeaderboardScope) -> bool:
        """
        Check if there are any subscribers for a specific leaderboard scope.
        """
        return bool(self.scope_subscriptions.get(scope))


    async def send_personal_message(self, message: Dict, websocket: WebSocket):
        await websocket.send_json(message)


    async def publish_snapshot(
        self,
        scope: LeaderboardScope,
        entries: List[LeaderboardEntry],
    ):
        """
        Publish a snapshot of the leaderboard to all subscribers.
        """
        subscribers = set(self.scope_subscriptions.get(scope, set()))
        if not subscribers:
            return

        message = _build_snapshot_message(scope, entries)

        # send updated leaderboard to all subscribers
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
    entries: List[LeaderboardEntry],
) -> Dict[str, object]:
    """
    builds snapshot of what the leaderboard looks like for a specific scope
    """
    scope_kind, dining_hall_id = scope
    message: Dict[str, object] = {
        "type": "leaderboard_snapshot",
        "scope": scope_kind,
        "entries": [entry.model_dump(mode="json") for entry in entries],
    }
    if scope_kind == "dining_hall" and dining_hall_id is not None:
        message["dining_hall_id"] = str(dining_hall_id)
    return message


def _validate_leaderboard_scope(message: Dict) -> LeaderboardScope:
    """
    Ensures scope exists and returns it.
    """
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
    """
    Get leaderboard entries for a specific scope(global or a specific dining hall).
    """
    scope_kind, dining_hall_id = scope
    if scope_kind == "global":
        return await get_leaderboard_entries(db_session=db_session, limit=100)
    return await get_leaderboard_entries(
        db_session=db_session,
        limit=100,
        dining_hall_id=dining_hall_id,
    )


async def publish_leaderboard_snapshots(
    db_session: AsyncSession,
    manager: ConnectionManager,
    affected_entries: List[UUID]
) -> None:
    """
    Publish leaderboard snapshot for the affected dining halls.

    NOTE: affected_entries can only have 2 elements.
    """
    if len(affected_entries) != 2:
        raise ValueError("Invalid affected_entries. Expected 2 elements.")

    # determines the scopes to publish snapshots for
    scopes: list[LeaderboardScope] = []
    if manager.has_subscribers(global_scope()):
        scopes.append(global_scope())

    scopes.extend(
        dining_hall_scope(dining_hall_id)
        for dining_hall_id in affected_entries
        if manager.has_subscribers(dining_hall_scope(dining_hall_id))
    )
    if not scopes:
        return

    # Fetch all entries sequentially (AsyncSession is not safe for concurrent use)
    scope_entries_map: dict[LeaderboardScope, list[LeaderboardEntry]] = {}
    for scope in scopes:
        entries = await _get_scope_entries(db_session, scope)
        scope_entries_map[scope] = entries

    # Publish snapshots concurrently (network operations are safe to parallelize)
    publish_tasks = [
        manager.publish_snapshot(scope, entries)
        for scope, entries in scope_entries_map.items()
    ]
    await asyncio.gather(*publish_tasks, return_exceptions=True)

async def handle_leaderboard_websocket(
    websocket: WebSocket,
    manager: ConnectionManager,
    db_session_maker: async_sessionmaker[AsyncSession],
):
    """
    Handle WebSocket connections for the leaderboard.
    """
    await manager.connect(websocket)
    try:
        while True:
            try:
                message = await websocket.receive_json()
                message_type = message.get("type")

                if message_type == "subscribe_leaderboard":
                    # determine what leaderboard were subscribed to (global or a specific dining_hall)
                    scope = _validate_leaderboard_scope(message)
                    manager.subscribe_leaderboard(websocket, scope)
                    
                    # create a new db session per fetch to grab up-to-date entries
                    async with db_session_maker() as db_session:
                        entries = await _get_scope_entries(db_session, scope)

                    # send leaderboard snapshot to the subscriber
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
