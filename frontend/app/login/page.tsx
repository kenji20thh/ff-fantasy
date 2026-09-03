'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function Login() {
  const { login } = useAuth()
  const router = useRouter()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()

    setBusy(true)
    setError('')

    try {
      await login(identifier, password)
      router.push('/dashboard')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to login'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <a href="/" className="eyebrow">
        FF / FANTASY
      </a>

      <h1 className="section-title">
        Enter the arena.
      </h1>

      <form
        onSubmit={submit}
        className="mt-8 space-y-4 border border-border bg-card p-6"
      >
        <label className="block text-sm">
          Username or email

          <input
            required
            type="text"
            value={identifier}
            onChange={e =>
              setIdentifier(e.target.value)
            }
            className="mt-2 w-full border border-border bg-background p-3"
          />
        </label>

        <label className="block text-sm">
          Password

          <input
            required
            type="password"
            value={password}
            onChange={e =>
              setPassword(e.target.value)
            }
            className="mt-2 w-full border border-border bg-background p-3"
          />
        </label>

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          disabled={busy}
          className="w-full bg-primary p-3 font-bold text-primary-foreground"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-sm text-muted-foreground">
          New player?{' '}
          <a
            className="text-primary"
            href="/register"
          >
            Create an account
          </a>
        </p>
      </form>
    </main>
  )
}