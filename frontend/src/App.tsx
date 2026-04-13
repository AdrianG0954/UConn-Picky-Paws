import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { Layout } from "./Layout";
import { CasCallbackPage } from "./pages/CasCallbackPage";

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
        {/* SSO return URL (must match backend SERVICE_URL path). */}
        <Route path="/callback" element={<CasCallbackPage />} />
        <Route path="/" element={<Layout />}>
          <Route element={<RequireAuth />}>
            <Route index element={<Navigate to="/rank" replace />} />
            <Route path="rank" element={<HeadToHead />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
