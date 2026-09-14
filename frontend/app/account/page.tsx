'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { errorMessage } from '@/lib/types'

export default function Account() {
  const { user, loading, refreshUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-10">
      <a href="/" className="eyebrow">
        FF / FANTASY
      </a>

      <h1 className="section-title">
        Profile.
      </h1>

      <ProfileCard
        username={user.username}
        email={user.email}
        role={user.role}
      />

      <UsernameForm
        currentUsername={user.username}
        onUpdated={refreshUser}
      />

      <PasswordForm />
    </main>
  )
}

function ProfileCard({
  username,
  email,
  role,
}: {
  username: string
  email: string
  role?: string
}) {
  return (
    <div className="mt-8 border border-border bg-card p-6">
      <h2 className="font-mono text-sm font-bold uppercase tracking-widest">
        Your profile
      </h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-mono">{username}</dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-mono">{email}</dd>
        </div>

        {role && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-mono uppercase text-primary">{role}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function UsernameForm({
  currentUsername,
  onUpdated,
}: {
  currentUsername: string
  onUpdated: () => Promise<void>
}) {
  const [username, setUsername] = useState(currentUsername)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (username.trim() === currentUsername) {
      setError('That is already your username.')
      return
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }

    setBusy(true)

    try {
      await api.changeUsername({ username: username.trim() })
      await onUpdated()
      setSuccess('Username updated successfully.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 border border-border bg-card p-6"
    >
      <h2 className="font-mono text-sm font-bold uppercase tracking-widest">
        Change username
      </h2>

      <label className="block text-sm">
        New username

        <input
          required
          type="text"
          minLength={3}
          maxLength={50}
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="mt-2 w-full border border-border bg-background p-3"
        />
      </label>

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-primary">
          {success}
        </p>
      )}

      <button
        disabled={busy}
        className="w-full bg-primary p-3 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Updating…' : 'Update username'}
      </button>
    </form>
  )
}

function PasswordForm() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setBusy(true)

    try {
      await api.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      })

      setSuccess('Password updated successfully.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 border border-border bg-card p-6"
    >
      <h2 className="font-mono text-sm font-bold uppercase tracking-widest">
        Change password
      </h2>

      <label className="block text-sm">
        Current password

        <input
          required
          type="password"
          value={oldPassword}
          onChange={e => setOldPassword(e.target.value)}
          className="mt-2 w-full border border-border bg-background p-3"
        />
      </label>

      <label className="block text-sm">
        New password

        <input
          required
          type="password"
          minLength={8}
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="mt-2 w-full border border-border bg-background p-3"
        />
      </label>

      <label className="block text-sm">
        Confirm new password

        <input
          required
          type="password"
          minLength={8}
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="mt-2 w-full border border-border bg-background p-3"
        />
      </label>

      {error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-primary">
          {success}
        </p>
      )}

      <button
        disabled={busy}
        className="w-full bg-primary p-3 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}