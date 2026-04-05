import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";

const HeadToHead = lazy(async () => {
  const m = await import("./pages/HeadToHeadPage");
  return { default: m.HeadToHead };
});

const LeaderboardPage = lazy(async () => {
  const m = await import("./pages/LeaderboardPage");
  return { default: m.LeaderboardPage };
});

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/rank" replace />} />
          <Route path="rank" element={<HeadToHead />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
