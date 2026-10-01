import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { PasswordInput } from '../components/PasswordInput.tsx'
import { authClient, authError, DEMO, settled } from '../lib/auth.ts'
import { P03Line } from '../components/p03/P03Line.tsx'

export function SignIn() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function signIn(identifier: string, password: string) {
    setBusy(true)
    setError(null)
    // An @ means an email address; usernames cannot contain one.
    const { error: failed } = await settled(
      identifier.includes('@')
        ? authClient.signIn.email({ email: identifier, password })
        : authClient.signIn.username({ username: identifier, password }),
    )
    setBusy(false)
    if (failed)
      return setError(
        failed.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : authError(failed, 'That did not work'),
      )
    toast.success('Signed in')
    navigate({ to: '/', replace: true })
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void signIn(String(form.get('identifier') ?? '').trim(), String(form.get('password') ?? ''))
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="font-display text-5xl">Sign in</h1>
      <P03Line>Back again? Identify yourself.</P03Line>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">Username or email</Label>
          <Input id="identifier" name="identifier" autoComplete="username" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-death">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy}>
          Sign in
        </Button>
      </form>
      <div className="flex flex-col gap-3 border-t pt-5">
        <p className="text-sm text-muted-foreground">Just looking?</p>
        <Button variant="outline" disabled={busy} onClick={() => void signIn(DEMO.username, DEMO.password)}>
          Play as the demo account
        </Button>
        <Button asChild variant="ghost">
          <Link to="/game">Or play a game of your own as a guest</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        New here?{' '}
        <Link to="/signup" className="text-primary underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </div>
  )
}
