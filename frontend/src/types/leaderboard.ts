export type DiningHallOption = {
  id: string;
  name: string;
};

export type LeaderboardEntry = {
  name: string;
  dining_hall_id: string;
  dining_hall_name: string;
  elo: number;
};

export type GlobalLeaderboardSnapshotMessage = {
  type: "leaderboard_snapshot";
  scope: "global";
  entries: LeaderboardEntry[];
};

export type DiningHallLeaderboardSnapshotMessage = {
  type: "leaderboard_snapshot";
  scope: "dining_hall";
  dining_hall_id: string;
  entries: LeaderboardEntry[];
};

export type LeaderboardSnapshotMessage =
  | GlobalLeaderboardSnapshotMessage
  | DiningHallLeaderboardSnapshotMessage;

export type LeaderboardErrorMessage = {
  type: "error";
  message: string;
};

export type GlobalTab = {
  key: "global";
  label: "Global";
  scope: "global";
};

export type DiningHallTab = {
  key: string;
  label: string;
  scope: "dining_hall";
  diningHallId: string;
};

export type LeaderboardTab = GlobalTab | DiningHallTab;
export type ConnectionState = "connecting" | "connected" | "reconnecting";
