import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import { Account } from './pages/Account.tsx'
import { Game } from './pages/Game.tsx'
import { Home } from './pages/Home.tsx'
import { Leaderboard } from './pages/Leaderboard.tsx'
import { MyStats } from './pages/MyStats.tsx'
import { NotFound } from './pages/NotFound.tsx'
import { Player } from './pages/Player.tsx'
import { SignIn } from './pages/SignIn.tsx'
import { SignUp } from './pages/SignUp.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<SignIn />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="players/:username" element={<Player />} />
        <Route
          path="stats"
          element={
            <RequireAuth>
              <MyStats />
            </RequireAuth>
          }
        />
        <Route
          path="account"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />
        <Route
          path="game"
          element={
            <RequireAuth>
              <Game />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
