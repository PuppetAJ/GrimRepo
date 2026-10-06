import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
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
import { api } from '../lib/api.ts'
import { authClient, authError, DEMO, settled } from '../lib/auth.ts'
import { useAsync } from '../lib/useAsync.ts'
import { P03Line } from '../components/p03/P03Line.tsx'

export function Account() {
  const session = authClient.useSession()
  const navigate = useNavigate()
  const user = session.data?.user as { displayUsername?: string; username?: string; email?: string } | undefined
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [password, setPassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const stats = useAsync(
    () => (user?.username ? api.stats(user.username) : Promise.resolve(null)),
    `account-stats:${user?.username}`,
  )
  // Only a player who has lost is told P03 remembers it.
  const lost = stats.status === 'ready' && Boolean(stats.data?.losses)

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const field = event.currentTarget.elements.namedItem('username') as HTMLInputElement
    // Focus reads the field's error aloud with its label.
    const refuse = (message: string) => {
      setRenameError(message)
      field.focus()
    }
    const username = field.value.trim()
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return refuse('3 to 20 letters, digits or underscores')
    setRenaming(true)
    const { error } = await settled(authClient.updateUser({ username } as Parameters<typeof authClient.updateUser>[0]))
    setRenaming(false)
    if (error) return refuse(authError(error, 'That name did not work'))
    setRenameError(null)
    await session.refetch()
    toast.success(`You are now ${username}`)
  }

  async function remove() {
    const { error } = await settled(authClient.deleteUser({ password }))
    if (error) return setDeleteError(authError(error, 'That did not work'))
    toast.success('Your account and its games are gone')
    navigate({ to: '/', replace: true })
  }

  if (user?.username === DEMO.username) return <DemoNotice />
  if ((user as { isAnonymous?: boolean } | undefined)?.isAnonymous) return <GuestNotice name={user?.username ?? ''} />

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl">Account</h1>
        <P03Line>
          Rename yourself all you like.{' '}
          {lost ? "I remember every time you've lost either way." : "I'll still know it's you."}
        </P03Line>
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
          required
          aria-invalid={Boolean(renameError)}
          aria-describedby="username-note"
        />
        <p id="username-note" className={`text-sm ${renameError ? 'text-death' : 'text-muted-foreground'}`}>
          {renameError ?? 'Your games and scores come with you.'}
        </p>
        <Button type="submit" className="self-start" disabled={renaming}>
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

/** Replaces the forms, which the server would refuse for the demo account anyway. */
function DemoNotice() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="font-display text-5xl">Account</h1>
      <P03Line>Everyone shares this one. I can&apos;t tell any of you apart. Not that I try.</P03Line>
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">You are using the demo account</h2>
        <p className="text-muted-foreground">
          Everyone shares it, so it can&apos;t be renamed or deleted. Make your own to keep your games and scores.
        </p>
        <Button asChild className="self-start">
          <Link to="/signup">Create an account</Link>
        </Button>
      </section>
    </div>
  )
}

function GuestNotice({ name }: { name: string }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="font-display text-5xl">Account</h1>
      <P03Line>A guest. You&apos;ll be gone in a week, and so will your record. Unless you sign up.</P03Line>
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-6">
        <h2 className="text-xl font-semibold">You are playing as a guest, {name}</h2>
        <p className="text-muted-foreground">
          Guest accounts last a week and stay off the leaderboard. Sign up to keep your games; they come with you.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup">Sign up</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">I already have an account</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
