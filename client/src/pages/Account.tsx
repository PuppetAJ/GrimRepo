import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { PasswordInput } from '../components/PasswordInput.tsx'
import { authClient, authError, DEMO } from '../lib/auth.ts'

export function Account() {
  const session = authClient.useSession()
  const navigate = useNavigate()
  const user = session.data?.user as { displayUsername?: string; username?: string; email?: string } | undefined
  const [renameError, setRenameError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const username = String(new FormData(event.currentTarget).get('username') ?? '').trim()
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setRenameError('3 to 20 letters, digits or underscores')
    const { error } = await authClient.updateUser({ username } as Parameters<typeof authClient.updateUser>[0])
    if (error) return setRenameError(authError(error, 'That name did not work'))
    setRenameError(null)
    await session.refetch()
    toast.success(`You are now ${username}`)
  }

  async function remove() {
    const { error } = await authClient.deleteUser({ password })
    if (error) return setDeleteError(authError(error, 'That did not work'))
    toast.success('Your account and its games are gone')
    navigate('/', { replace: true })
  }

  if (user?.username === DEMO.username) return <DemoNotice />

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-10">
      <div>
        <h1 className="font-display text-5xl">Account</h1>
        <p className="text-muted-foreground">Signed in as {user?.email}.</p>
      </div>

      <form onSubmit={rename} className="flex flex-col gap-3 border-t pt-6" noValidate>
        <h2 className="text-xl font-semibold">Username</h2>
        <Label htmlFor="username">New username</Label>
        <Input
          id="username"
          name="username"
          defaultValue={user?.displayUsername ?? user?.username}
          autoComplete="username"
          aria-describedby="username-note"
        />
        <p id="username-note" className={`text-sm ${renameError ? 'text-death' : 'text-muted-foreground'}`}>
          {renameError ?? 'Your games and scores come with you.'}
        </p>
        <Button type="submit" className="self-start">
          Rename
        </Button>
      </form>

      <section className="flex flex-col gap-3 border-t pt-6">
        <h2 className="text-xl font-semibold">Delete your account</h2>
        <p className="text-sm text-muted-foreground">
          Your account, your games and your place on the leaderboard go for good.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="self-start">
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone. Enter your password to confirm.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-password">Password</Label>
              <PasswordInput
                id="delete-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              {deleteError ? (
                <p role="alert" className="text-sm text-death">
                  {deleteError}
                </p>
              ) : null}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(event) => {
                  event.preventDefault()
                  void remove()
                }}
              >
                Delete for good
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  )
}

/** Shown to the demo account instead of the forms, which the server would refuse anyway. */
function DemoNotice() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="font-display text-5xl">Account</h1>
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">You are using the demo account</h2>
        <p className="text-muted-foreground">
          Everyone trying Grim Repo shares this account, so its name and password are fixed and it cannot be deleted.
          Its games and scores are shared too.
        </p>
        <p className="text-muted-foreground">
          Make an account of your own to keep your games and your place on the leaderboard.
        </p>
        <Button asChild className="self-start">
          <Link to="/signup">Create an account</Link>
        </Button>
      </section>
    </div>
  )
}
