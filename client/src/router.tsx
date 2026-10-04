import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouterHistory,
} from '@tanstack/react-router'
import * as z from 'zod/mini'
import { Layout } from './components/Layout.tsx'
import { ReloadPage } from './components/LoadFailed.tsx'
import { RequireAuth } from './components/RequireAuth.tsx'
import type { Finished } from './lib/api.ts'
import { Home } from './pages/Home.tsx'
import { Leaderboard } from './pages/Leaderboard.tsx'
import { NotFound } from './pages/NotFound.tsx'

// Home and the leaderboard ship in the first load; every other page loads on demand.
const Account = lazyRouteComponent(() => import('./pages/Account.tsx'), 'Account')
const Cards = lazyRouteComponent(() => import('./pages/Cards.tsx'), 'Cards')
const Game = lazyRouteComponent(() => import('./pages/Game.tsx'), 'Game')
const MyStats = lazyRouteComponent(() => import('./pages/MyStats.tsx'), 'MyStats')
const Player = lazyRouteComponent(() => import('./pages/Player.tsx'), 'Player')
const Run = lazyRouteComponent(() => import('./pages/Run.tsx'), 'Run')
const MockupIndex = lazyRouteComponent(() => import('./pages/Mockups.tsx'), 'MockupIndex')
const MockupRun = lazyRouteComponent(() => import('./pages/Mockups.tsx'), 'MockupRun')
const SignIn = lazyRouteComponent(() => import('./pages/SignIn.tsx'), 'SignIn')
const SignUp = lazyRouteComponent(() => import('./pages/SignUp.tsx'), 'SignUp')

// A bad value falls back rather than failing the page, since anyone can type an address.
const optional = <T extends z.core.SomeType>(schema: T) => z.catch(z.optional(schema), undefined)

const page = z.object({ page: optional(z.coerce.number().check(z.int(), z.minimum(2))) })

const cardsSearch = z.object({
  q: optional(z.coerce.string()),
  view: optional(z.enum(['3d'])),
  sort: optional(z.string()),
  order: optional(z.enum(['desc'])),
  cost: optional(z.coerce.string()),
  card: optional(z.string()),
})

const gameSearch = z.object({
  text: optional(z.string()),
  layout: optional(z.enum(['wide', 'mid', 'phone'])),
  fixture: optional(z.string()),
})

const runSearch = z.object({ layout: optional(z.enum(['wide', 'mid', 'phone'])) })

export type CardsSearch = z.infer<typeof cardsSearch>
export type GameSearch = z.infer<typeof gameSearch>

const root = createRootRoute({ component: Layout, notFoundComponent: NotFound })

const parent = () => root

// Each route is its own constant: written inline in addChildren, their types collapse to strings.
const home = createRoute({ getParentRoute: parent, path: '/', component: Home })
const signIn = createRoute({ getParentRoute: parent, path: '/login', component: SignIn })
const signUp = createRoute({ getParentRoute: parent, path: '/signup', component: SignUp })
const leaderboard = createRoute({
  getParentRoute: parent,
  path: '/leaderboard',
  validateSearch: page,
  component: Leaderboard,
})
const cards = createRoute({ getParentRoute: parent, path: '/cards', validateSearch: cardsSearch, component: Cards })
const player = createRoute({
  getParentRoute: parent,
  path: '/players/$username',
  validateSearch: page,
  component: Player,
})
const stats = createRoute({
  getParentRoute: parent,
  path: '/stats',
  component: () => (
    <RequireAuth>
      <MyStats />
    </RequireAuth>
  ),
})
const account = createRoute({
  getParentRoute: parent,
  path: '/account',
  component: () => (
    <RequireAuth>
      <Account />
    </RequireAuth>
  ),
})
const game = createRoute({
  getParentRoute: parent,
  path: '/game',
  validateSearch: gameSearch,
  component: () => (
    <RequireAuth guest>
      <Game />
    </RequireAuth>
  ),
})

// Not linked from the home page until the 3D table plays runs too.
const run = createRoute({
  getParentRoute: parent,
  path: '/run',
  validateSearch: runSearch,
  component: () => (
    <RequireAuth guest>
      <Run />
    </RequireAuth>
  ),
})

// Development and test builds only; production shows the not-found page.
const mockups = createRoute({ getParentRoute: parent, path: '/run/mockups', component: MockupIndex })
const mockup = createRoute({
  getParentRoute: parent,
  path: '/run/mockups/$name',
  validateSearch: runSearch,
  component: MockupRun,
})

const tree = root.addChildren([
  home,
  signIn,
  signUp,
  leaderboard,
  cards,
  player,
  stats,
  account,
  game,
  run,
  mockups,
  mockup,
])

/** Plain `?key=value` addresses, as before, rather than the router's JSON values; a bare key is a flag. */
function parseSearch(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search))
}

function stringifySearch(search: Record<string, unknown>): string {
  const parts = Object.entries(search)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) =>
      value === '' ? encodeURIComponent(key) : `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
  return parts.length ? `?${parts.join('&')}` : ''
}

/** The prerender passes a memory history and an origin, since it has no window. */
export function makeRouter(history?: RouterHistory, origin?: string) {
  return createRouter({
    routeTree: tree,
    history,
    origin,
    parseSearch,
    stringifySearch,
    defaultPreload: 'intent',
    defaultErrorComponent: ReloadPage,
    // Only in the browser: the prerender would write it as an inline script, which the CSP blocks.
    scrollRestoration: typeof document !== 'undefined',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof makeRouter>
  }
  // Set by the game page when a game ends, for the leaderboard to show.
  interface HistoryState {
    result?: Finished
  }
}
