'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, Shield, Trophy, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'

const links = [
  ['/teams', 'Teams'],
  ['/schedule', 'Schedule'],
  ['/players', 'Players'],
  ['/leaderboard', 'Leaderboard'],
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  async function signOut() {
    await logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-3 font-mono text-sm font-bold tracking-[.16em]"
          >
            <span className="grid size-8 place-items-center bg-primary text-primary-foreground">
              <Trophy size={16} />
            </span>

            FF<span className="text-primary">/</span>FANTASY
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {links.map(([href, label]) => (
              <Link
                key={href}
                className={
                  pathname.startsWith(href)
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }
                href={href}
              >
                {label}
              </Link>
            ))}

            {user ? (
              <>
                <Link
                  className="text-muted-foreground"
                  href="/fantasy-team"
                >
                  My fantasy team
                </Link>

                {user.role === 'admin' && (
                  <Link
                    className="flex items-center gap-1 text-primary"
                    href="/admin"
                  >
                    <Shield size={14} />
                    Admin
                  </Link>
                )}

                <button
                  onClick={signOut}
                  className="text-muted-foreground"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  Login
                </Link>

                <Link
                  href="/register"
                  className="bg-primary px-4 py-2 font-bold text-primary-foreground"
                >
                  Register
                </Link>
              </>
            )}
          </nav>

          <button
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {open && (
          <nav className="flex flex-col gap-4 border-t border-border px-4 py-5 md:hidden">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}

            {user ? (
              <>
                <Link href="/dashboard">
                  Dashboard
                </Link>

                <Link href="/fantasy-team">
                  My fantasy team
                </Link>

                {user.role === 'admin' && (
                  <Link href="/admin">
                    Admin
                  </Link>
                )}

                <button
                  className="text-left"
                  onClick={signOut}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  Login
                </Link>

                <Link href="/register">
                  Register
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      {children}
    </div>
  )
}

export function Notice({
  children,
  kind = 'info',
}: {
  children: React.ReactNode
  kind?: 'info' | 'error' | 'success'
}) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`border p-4 text-sm ${
        kind === 'error'
          ? 'border-red-400/50 text-red-200'
          : kind === 'success'
            ? 'border-primary/50 text-primary'
            : 'border-border text-muted-foreground'
      }`}
    >
      {children}
    </div>
  )
}

export function Loading({
  label = 'Loading...',
}: {
  label?: string
}) {
  return (
    <div className="flex min-h-48 items-center justify-center font-mono text-sm text-muted-foreground">
      <span className="mr-3 size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  )
}

export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">
          {eyebrow}
        </p>

        <h1 className="section-title">
          {title}
        </h1>
      </div>

      {children}
    </div>
  )
}

export const inputClass =
  'w-full border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary'

export const buttonClass =
  'bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40'

export const secondaryClass =
  'border border-border px-5 py-3 text-xs font-bold uppercase tracking-widest text-foreground hover:border-primary'

export function Empty({
  label,
}: {
  label: string
}) {
  return (
    <div className="border border-dashed border-border p-10 text-center text-muted-foreground">
      {label}
    </div>
  )
}