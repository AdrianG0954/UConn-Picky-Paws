import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth";
import { Layout } from "./Layout";
import { CasCallbackPage } from "./pages/CasCallbackPage";
import { HeadToHead } from "./pages/HeadToHeadPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { SignInPage } from "./pages/SignInPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/callback" element={<CasCallbackPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<SignInPage />} />
          <Route element={<RequireAuth />}>
            <Route path="rank" element={<HeadToHead />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
