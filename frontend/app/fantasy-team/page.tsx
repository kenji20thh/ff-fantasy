
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/types'

type MyFantasyTeam = {
  id: number
  user_id: number
  player_ids?: number[] | null
  captain_player_id?: number | null
}

export default function FantasyTeam() {
  const { user } = useAuth()

  const [myTeam, setMyTeam] =
    useState<MyFantasyTeam | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [message, setMessage] =
    useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    api.myFantasyTeam()
      .then(response => {
        setMyTeam(response as MyFantasyTeam)
      })
      .catch(error => {
        const apiError = error as { status?: number }

        if (apiError.status === 404) {
          // User does not have a fantasy team.
          setMyTeam(null)
          return
        }

        setMessage(errorMessage(error))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user])

  if (!user) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <Link href="/" className="eyebrow">
          ← FF / FANTASY
        </Link>

        <div className="mt-16 max-w-2xl">
          <p className="eyebrow">
            Fantasy
          </p>

          <h1 className="section-title mt-4">
            Sign in to access your fantasy team.
          </h1>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <Link href="/" className="eyebrow">
          ← FF / FANTASY
        </Link>

        <p className="mt-12 text-muted-foreground">
          Checking your fantasy team...
        </p>
      </main>
    )
  }

  if (message) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <Link href="/" className="eyebrow">
          ← FF / FANTASY
        </Link>

        <p className="mt-12 border border-red-500/40 bg-card p-4 text-sm text-red-400">
          {message}
        </p>
      </main>
    )
  }

  /*
   * CASE 1:
   * User does not have a fantasy team.
   */
  if (!myTeam) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <Link href="/" className="eyebrow">
          ← FF / FANTASY
        </Link>

        <div className="mt-16 max-w-2xl">
          <p className="eyebrow">
            Fantasy
          </p>

          <h1 className="section-title mt-4">
            Build your fantasy team.
          </h1>

          <p className="mt-6 text-muted-foreground">
            Select four players from four different teams
            and choose your captain.
          </p>

          <Link
            href="/fantasy-team/builder"
            className="mt-8 inline-block bg-primary px-6 py-3 font-bold text-primary-foreground"
          >
            Create Fantasy Team
          </Link>
        </div>
      </main>
    )
  }

  /*
   * CASE 2:
   * User already has a fantasy team.
   */
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <Link href="/" className="eyebrow">
        ← FF / FANTASY
      </Link>

      <div className="mt-16 max-w-2xl">
        <p className="eyebrow">
          Fantasy
        </p>

        <h1 className="section-title mt-4">
          Your fantasy team.
        </h1>

        <p className="mt-6 text-muted-foreground">
          You already have a fantasy team.
        </p>

        <Link
          href={`/fantasy-team/${myTeam.id}`}
          className="mt-8 inline-block bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          View Fantasy Team
        </Link>
      </div>
    </main>
  )
}

