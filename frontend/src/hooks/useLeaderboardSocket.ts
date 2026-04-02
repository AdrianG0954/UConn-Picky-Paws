import { useEffect, useRef, useState } from 'react';
import type {
  ConnectionState,
  LeaderboardTab,
  LeaderboardEntry,
  LeaderboardErrorMessage,
  LeaderboardSnapshotMessage,
} from '../types/leaderboard';

function buildWebSocketUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

/* Validators for incoming ws message (snapshot of leaderboard) */
function isSnapshotMessage(
  message: unknown,
): message is LeaderboardSnapshotMessage {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as Record<string, unknown>;
  if (candidate.type !== 'leaderboard_snapshot') return false;
  if (candidate.scope !== 'global' && candidate.scope !== 'dining_hall') {
    return false;
  }
  return Array.isArray(candidate.entries);
}

function isErrorMessage(message: unknown): message is LeaderboardErrorMessage {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as Record<string, unknown>;
  return candidate.type === 'error' && typeof candidate.message === 'string';
}

function buildSubscriptionMessage(tab: LeaderboardTab) {
  if (tab.scope === 'global') {
    return { type: 'subscribe_leaderboard', scope: 'global' as const };
  }

  return {
    type: 'subscribe_leaderboard' as const,
    scope: 'dining_hall' as const,
    dining_hall_id: tab.diningHallId,
  };
}

function snapshotMatchesTab(
  snapshot: LeaderboardSnapshotMessage,
  tab: LeaderboardTab,
): boolean {
  if (tab.scope === 'global') return snapshot.scope === 'global';
  return (
    snapshot.scope === 'dining_hall' &&
    snapshot.dining_hall_id === tab.diningHallId
  );
}

type UseLeaderboardSocketResult = {
  connectionState: ConnectionState;
  entries: LeaderboardEntry[];
  loading: boolean;
  socketError: string | null;
};

export function useLeaderboardSocket(
  selectedTab: LeaderboardTab,
): UseLeaderboardSocketResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('connecting');
  const [loading, setLoading] = useState(true);
  const [socketError, setSocketError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const selectedTabRef = useRef<LeaderboardTab>(selectedTab);

  useEffect(() => {
    const previousTab = selectedTabRef.current;
    selectedTabRef.current = selectedTab;

    if (previousTab.key === selectedTab.key) return;

    setEntries([]);
    setLoading(true);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify(buildSubscriptionMessage(selectedTab)),
      );
    }
  }, [selectedTab]);

  useEffect(() => {
    let cancelled = false;

    function clearReconnectTimer() {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (cancelled || reconnectTimerRef.current !== null) return;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, 1000);
    }

    function closeCurrentSocket() {
      const socket = socketRef.current;
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socketRef.current = null;
    }

    function connect() {
      if (cancelled) return;

      setConnectionState((current) =>
        current === 'reconnecting' ? 'reconnecting' : 'connecting',
      );
      const socket = new WebSocket(buildWebSocketUrl('/ws/leaderboard'));
      socketRef.current = socket;

      // These callbacks are exposed by the WebSocket object and are fired by the browser
      socket.onopen = () => {
        if (cancelled) return;
        setConnectionState('connected');
        setSocketError(null);
        socket.send(
          JSON.stringify(buildSubscriptionMessage(selectedTabRef.current)),
        );
      };

      socket.onmessage = (event) => {
        let message: unknown;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          setSocketError('Received an invalid websocket message.');
          return;
        }

        if (isSnapshotMessage(message)) {
          if (!snapshotMatchesTab(message, selectedTabRef.current)) return;
          setEntries(message.entries.slice(0, 10));
          setLoading(false);
          setSocketError(null);
          return;
        }

        if (isErrorMessage(message)) {
          setSocketError(message.message);
          setLoading(false);
        }
      };

      socket.onerror = () => {
        if (cancelled) return;
        setSocketError('Live updates are unavailable. Retrying...');
      };

      socket.onclose = () => {
        if (cancelled) return;
        socketRef.current = null;
        setConnectionState('reconnecting');
        setSocketError('Live updates are unavailable. Retrying...');
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      closeCurrentSocket();
    };
  }, []);

  return {
    connectionState,
    entries,
    loading,
    socketError,
  };
}
