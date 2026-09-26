import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import { Home } from './pages/Home.tsx'
import { Leaderboard } from './pages/Leaderboard.tsx'
import { NotFound } from './pages/NotFound.tsx'

// The home page and the leaderboard come with the first load; every other page loads when it is opened.
const Account = lazy(() => import('./pages/Account.tsx').then((page) => ({ default: page.Account })))
const Game = lazy(() => import('./pages/Game.tsx').then((page) => ({ default: page.Game })))
const MyStats = lazy(() => import('./pages/MyStats.tsx').then((page) => ({ default: page.MyStats })))
const Player = lazy(() => import('./pages/Player.tsx').then((page) => ({ default: page.Player })))
const SignIn = lazy(() => import('./pages/SignIn.tsx').then((page) => ({ default: page.SignIn })))
const SignUp = lazy(() => import('./pages/SignUp.tsx').then((page) => ({ default: page.SignUp })))

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
