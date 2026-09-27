import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx'
import { authClient } from '../lib/auth.ts'
import { Avatar } from './Avatar.tsx'
import { Logo } from './Logo.tsx'
import { Loading } from './States.tsx'

const tabs = [
  { to: '/', label: 'README', end: true },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/cards', label: 'Cards' },
  { to: '/game', label: 'Play' },
]

export function Layout() {
  const session = authClient.useSession()
  const navigate = useNavigate()
  const user = session.data?.user as { displayUsername?: string; username?: string; isAnonymous?: boolean } | undefined
  const name = user?.displayUsername ?? user?.username

  async function signOut() {
    await authClient.signOut()
    toast.success('Signed out')
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b bg-chrome px-4 py-3 sm:px-12">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden rounded-full border border-input px-2.5 py-0.5 text-xs text-muted-foreground md:inline">
            Public, unfortunately
          </span>
        </div>
        {/* While the session loads, an invisible button holds the header at its full height, so the page never drops. */}
        {session.isPending ? (
          <Button variant="outline" aria-hidden tabIndex={-1} className="invisible">
            Sign in
          </Button>
        ) : name ? (
          <div className="flex gap-2">
            {/* A guest's way to keep what they've played, always in reach. */}
            {user?.isAnonymous ? (
              <Button asChild>
                <NavLink to="/signup">Sign up</NavLink>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="Account menu" className="gap-2">
                  <Avatar name={name} size="sm" />
                  <span className="hidden sm:inline">{name}</span>
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate(`/players/${name}`)}>
                  <UserRound aria-hidden /> Your stats
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/account')}>
                  <Settings aria-hidden /> Account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut aria-hidden /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <NavLink to="/signup">Sign up</NavLink>
            </Button>
            <Button asChild>
              <NavLink to="/login">Sign in</NavLink>
            </Button>
          </div>
        )}
      </header>

      <nav
        aria-label="Sections"
        className="flex gap-2 overflow-x-auto border-b px-4 text-sm max-[380px]:gap-0 max-[380px]:px-2.5 sm:px-12"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `border-b-2 px-3 py-3.5 whitespace-nowrap max-[380px]:px-1.5 ${isActive ? 'border-death font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 px-4 py-8 sm:px-12">
        <Suspense fallback={<Loading label="Loading" />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t px-4 py-6 text-sm text-muted-foreground sm:px-12">
        A tribute to Inscryption. Built by Adrian Jimenez.
      </footer>
    </div>
  )
}
