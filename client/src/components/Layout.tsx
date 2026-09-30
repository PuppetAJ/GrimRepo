import { ChevronDown, LogIn, LogOut, Menu, Settings, UserPlus, UserRound } from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { LoadFailed, ReloadPage } from './LoadFailed.tsx'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx'
import { authClient, settled } from '../lib/auth.ts'
import { Avatar } from './Avatar.tsx'
import { Logo } from './Logo.tsx'
import { Loading } from './States.tsx'

const tabs = [
  { to: '/', label: 'README', end: true },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/cards', label: 'Cards' },
  { to: '/game', label: 'Play' },
]

// One max width so the header, nav, page and footer line up.
const PAGE = 'mx-auto w-full max-w-[100rem]'

export function Layout() {
  const session = authClient.useSession()
  const { pathname } = useLocation()
  const playing = pathname.startsWith('/game')
  const navigate = useNavigate()
  const user = session.data?.user as { displayUsername?: string; username?: string; isAnonymous?: boolean } | undefined
  const name = user?.displayUsername ?? user?.username

  async function signOut() {
    const { error } = await settled(authClient.signOut())
    if (error) return void toast.error(`Could not sign out: ${error.message}`)
    toast.success('Signed out')
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-chrome px-(--gutter) py-3">
        <div className={`${PAGE} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-full border border-input px-2.5 py-0.5 text-xs text-muted-foreground md:inline">
              Public, unfortunately
            </span>
          </div>
          {/* Holds the header's height while the session loads, so the page doesn't jump. */}
          {session.isPending ? (
            <Button variant="outline" aria-hidden tabIndex={-1} className="invisible">
              Sign in
            </Button>
          ) : (
            <>
              <div className="hidden gap-2 sm:flex">
                {name ? (
                  <>
                    {user?.isAnonymous ? (
                      <Button asChild>
                        <NavLink to="/signup">Sign up</NavLink>
                      </Button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" aria-label="Account menu" className="gap-2">
                          <Avatar name={name} size="sm" />
                          <span>{name}</span>
                          <ChevronDown aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <AccountItems name={name} onSignOut={signOut} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <NavLink to="/signup">Sign up</NavLink>
                    </Button>
                    <Button asChild>
                      <NavLink to="/login">Sign in</NavLink>
                    </Button>
                  </>
                )}
              </div>
              {/* Phones get one menu so the header never wraps. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" aria-label={name ? 'Account menu' : 'Menu'} className="gap-2 sm:hidden">
                    {name ? <Avatar name={name} size="sm" /> : null}
                    <Menu aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  {name ? (
                    <>
                      <DropdownMenuLabel>{name}</DropdownMenuLabel>
                      {user?.isAnonymous ? (
                        <DropdownMenuItem onSelect={() => navigate('/signup')}>
                          <UserPlus aria-hidden /> Sign up
                        </DropdownMenuItem>
                      ) : null}
                      <AccountItems name={name} onSignOut={signOut} />
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onSelect={() => navigate('/login')}>
                        <LogIn aria-hidden /> Sign in
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => navigate('/signup')}>
                        <UserPlus aria-hidden /> Sign up
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </header>

      <nav aria-label="Sections" className="overflow-x-auto border-b px-(--gutter) text-sm max-[350px]:px-2">
        <div className={`${PAGE} flex gap-2 max-[350px]:justify-between max-[350px]:gap-0`}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `border-b-2 px-3 py-3.5 whitespace-nowrap max-[350px]:px-2 ${isActive ? 'border-death font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="flex-1 px-(--gutter) py-8">
        {/* Capped so a browser zoomed far out stays readable; the game table is uncapped. */}
        <div className={playing ? '' : PAGE}>
          {/* Keyed by the path, so leaving a page that failed clears the failure. */}
          <LoadFailed key={pathname} fallback={<ReloadPage />}>
            <Suspense fallback={<Loading label="Loading" />}>
              <Outlet />
            </Suspense>
          </LoadFailed>
        </div>
      </main>

      <footer className="border-t px-(--gutter) py-6 text-sm text-muted-foreground">
        <div className={PAGE}>A tribute to Inscryption. Built by Adrian Jimenez.</div>
      </footer>
    </div>
  )
}

function AccountItems({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const navigate = useNavigate()
  return (
    <>
      <DropdownMenuItem onSelect={() => navigate(`/players/${name}`)}>
        <UserRound aria-hidden /> Your stats
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => navigate('/account')}>
        <Settings aria-hidden /> Account
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onSignOut}>
        <LogOut aria-hidden /> Sign out
      </DropdownMenuItem>
    </>
  )
}
