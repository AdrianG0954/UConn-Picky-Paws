import { useEffect, useState } from "react";
import { refetchTopDishes } from "../api";
import { supabase, syncRealtimeAuth } from "../utils/supabase";
import type {
  ConnectionState,
  LeaderboardEntry,
  LeaderboardTab,
} from "../types/leaderboard";

type UseLeaderboardSocketResult = {
  connectionState: ConnectionState;
  entries: LeaderboardEntry[];
  loading: boolean;
  socketError: string | null;
};

function eloChanged(payload: {
  old: Record<string, unknown>;
  new: Record<string, unknown>;
}) {
  return payload.old?.elo_rating !== payload.new?.elo_rating;
}

export function useLeaderboardSocket(
  selectedTab: LeaderboardTab,
): UseLeaderboardSocketResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [loading, setLoading] = useState(true);
  const [socketError, setSocketError] = useState<string | null>(null);

  useEffect(() => {
    void syncRealtimeAuth();

    async function runRefetch() {
      try {
        const nextEntries = await refetchTopDishes(selectedTab);
        setEntries(nextEntries);
        setSocketError(null);
      } catch (error) {
        setSocketError(
          error instanceof Error
            ? error.message
            : "Live updates are unavailable.",
        );
      } finally {
        setLoading(false);
      }
    }

    setConnectionState("connecting");
    setSocketError(null);
    setLoading(true);
    setEntries([]);

    const channelName =
      selectedTab.scope === "dining_hall"
        ? `meals-${selectedTab.diningHallId}`
        : "meals-global";


    
    // TODO: This needs to be stress tested. Unsure if this will perform well under many changes. Could try batching
    // Subscribe via postgres realtime. Listen on separate channels for global or dining halls
    
    let channel = supabase.channel(channelName).on(
      "postgres_changes",
      selectedTab.scope === "dining_hall"
        ? {
            event: "UPDATE",
            schema: "public",
            table: "dishes",
            filter: `dining_hall_id=eq.${selectedTab.diningHallId}`,
          }
        : {
            event: "UPDATE",
            schema: "public",
            table: "dishes",
          },
      async (payload) => {
        if (!eloChanged(payload)) {
          return;
        }

        await runRefetch();
      },
    );

    channel = channel.subscribe((status, err) => {
      console.log(status, err)
      if (status === "SUBSCRIBED") {
        setConnectionState("connected");
        runRefetch();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnectionState("reconnecting");
        setSocketError("Live updates are unavailable. Retrying...");
        setLoading(false);
        return;
      }

      if (status === "CLOSED") {
        setConnectionState("reconnecting");
        setLoading(false);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedTab]);

  return {
    connectionState,
    entries,
    loading,
    socketError,
  };
}
