import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HeadToHead } from './HeadToHead'
import { Layout } from './Layout'
import { LeaderboardPage } from './LeaderboardPage'

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
  )
}

export default App
