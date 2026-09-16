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

type TournamentDay = {
  id: number
  name?: string
  deadline_at: string
}

type FantasyDay = {
  day_id: number
  day_name?: string
}

type FantasyPointsResponse = {
  days?: FantasyDay[]
}

export default function FantasyTeam() {
  const { user } = useAuth()

  const [myTeam, setMyTeam] =
    useState<MyFantasyTeam | null>(null)

  const [nextDay, setNextDay] =
    useState<TournamentDay | null>(null)

  const [hasNextDayTeam, setHasNextDayTeam] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const [message, setMessage] =
    useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    async function loadFantasyStatus() {
      try {
        /*
         * Get the user's existing fantasy team.
         */
        let team: MyFantasyTeam | null = null

        try {
          const response = await api.myFantasyTeam()
          team = response as MyFantasyTeam
          setMyTeam(team)
        } catch (error) {
          const apiError = error as { status?: number }

          if (apiError.status !== 404) {
            throw error
          }

          /*
           * User has never created a fantasy team.
           */
          setMyTeam(null)
        }

        /*
         * Get all tournament days.
         */
        const daysResponse = await api.days()

        const days = Array.isArray(daysResponse)
          ? (daysResponse as TournamentDay[])
          : []

        /*
         * Find the next tournament day that has not
         * reached its deadline yet.
         */
        const upcomingDays = days
          .filter((day) => {
            if (!day.deadline_at) {
              return false
            }

            return new Date(day.deadline_at).getTime() > Date.now()
          })
          .sort(
            (a, b) =>
              new Date(a.deadline_at).getTime() -
              new Date(b.deadline_at).getTime(),
          )

        const upcomingDay = upcomingDays[0] ?? null

        setNextDay(upcomingDay)

        /*
         * If the user doesn't have any fantasy team,
         * the builder will handle creating one for the
         * upcoming day.
         */
        if (!team || !upcomingDay) {
          setHasNextDayTeam(false)
          return
        }

        /*
         * The fantasy team itself is shared across
         * tournament days, so we need to check whether
         * this existing team has a selection for the
         * UPCOMING day.
         */
        const pointsResponse =
          await api.fantasyPoints(team.id)

        const fantasyPoints =
          pointsResponse as FantasyPointsResponse

        const daysWithTeam =
          fantasyPoints.days ?? []

        const existsForNextDay =
          daysWithTeam.some(
            (day) => day.day_id === upcomingDay.id,
          )

        setHasNextDayTeam(existsForNextDay)
      } catch (error) {
        setMessage(errorMessage(error))
      } finally {
        setLoading(false)
      }
    }

    loadFantasyStatus()
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
   *
   * User has never created a fantasy team.
   *
   * Builder already opens the next available day,
   * which is currently Point Rush.
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
   *
   * User already has a fantasy team, BUT they have
   * NOT created one for the upcoming tournament day.
   *
   * Send them to the builder instead of showing their
   * previous day's team.
   */
  if (!hasNextDayTeam) {
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
            Build your next fantasy team.
          </h1>

          <p className="mt-6 text-muted-foreground">
            You have not created a fantasy team for the
            next tournament day yet.
          </p>

          {nextDay && (
            <p className="mt-3 text-sm font-semibold text-primary">
              Next day: {nextDay.name ?? `Day ${nextDay.id}`}
            </p>
          )}

          <Link
            href="/fantasy-team/builder"
            className="mt-8 inline-block bg-primary px-6 py-3 font-bold text-primary-foreground"
          >
            Build Fantasy Team
          </Link>
        </div>
      </main>
    )
  }

  /*
   * CASE 3:
   *
   * User already has a fantasy team for the NEXT
   * tournament day.
   *
   * Now it is safe to send them to [id].
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
          You already have a fantasy team for the next
          tournament day.
        </p>

        {nextDay && (
          <p className="mt-3 text-sm font-semibold text-primary">
            Next day: {nextDay.name ?? `Day ${nextDay.id}`}
          </p>
        )}

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