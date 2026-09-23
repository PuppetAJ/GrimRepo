import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Label } from '@/components/ui/label.tsx'
import { PasswordInput } from '../components/PasswordInput.tsx'
import { authClient, authError } from '../lib/auth.ts'
import { safeNext } from '../lib/next.ts'

// The server checks all of this too; this only saves a round trip and explains the rule.
const schema = z.object({
  username: z.string().regex(/^[A-Za-z0-9_]{3,20}$/, '3 to 20 letters, digits or underscores'),
  email: z.email('That does not look like an email address'),
  password: z.string().min(10, 'At least 10 characters'),
})

type Field = keyof z.infer<typeof schema>

export function SignUp() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({})
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = schema.safeParse({
      username: String(form.get('username') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])))
      return
    }
    setBusy(true)
    setErrors({})
    const { error } = await authClient.signUp.email({ ...parsed.data, name: parsed.data.username })
    setBusy(false)
    if (error)
      return setErrors({
        form:
          error.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : authError(error, 'That did not work'),
      })
    toast.success(`Welcome, ${parsed.data.username}`)
    navigate(next, { replace: true })
  }

  const field = (name: Field, label: string, input: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {input}
      {errors[name] ? (
        <p id={`${name}-error`} className="text-sm text-death">
          {errors[name]}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )

  const describedBy = (name: Field) => (errors[name] ? `${name}-error` : `${name}-hint`)

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <h1 className="font-display text-5xl">Create an account</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {field(
          'username',
          'Username',
          <Input
            id="username"
            name="username"
            autoComplete="username"
            aria-invalid={Boolean(errors.username)}
            aria-describedby={describedBy('username')}
          />,
          'Shown on the leaderboard. Letters, digits and underscores.',
        )}
        {field(
          'email',
          'Email',
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy('email')}
          />,
          'Never shown to anyone.',
        )}
        {field(
          'password',
          'Password',
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={describedBy('password')}
          />,
          'At least 10 characters.',
        )}
        {errors.form ? (
          <p role="alert" className="text-sm text-death">
            {errors.form}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy}>
          Create account
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Already have one?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
