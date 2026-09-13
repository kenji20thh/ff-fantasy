'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'
import type { LeaderboardEntry, TournamentDay } from '@/lib/types'

type CurrentUser = {
  id: number
  username: string
  email: string
  role: string
}

export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [days, setDays] = useState<TournamentDay[]>([])
  const [selectedDay, setSelectedDay] = useState('')
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [state, setState] = useState('Loading leaderboard…')

  useEffect(() => {
    api.me()
      .then((data) => {
        setCurrentUser(data as CurrentUser)
      })
      .catch(() => {
        setCurrentUser(null)
      })

    api.days()
      .then((data) => {
        setDays(asArray<TournamentDay>(data))
      })
      .catch(() => {
        setDays([])
      })
  }, [])

  useEffect(() => {
    setState('Loading leaderboard…')

    const dayId = selectedDay
      ? Number(selectedDay)
      : undefined

    api.leaderboard(dayId)
      .then((data) => {
        setRows(asArray<LeaderboardEntry>(data))
        setState('')
      })
      .catch((error) => {
        setState(errorMessage(error))
        setRows([])
      })
  }, [selectedDay])

  /*
   * Find the logged-in user's row.
   *
   * We compare both user_id and username so this still works
   * even if the backend represents the ID slightly differently.
   */
  const currentUserRow = currentUser
    ? rows.find(
        (row) =>
          Number(row.user_id) === Number(currentUser.id) ||
          row.username === currentUser.username
      )
    : null

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
      <a href="/" className="eyebrow">
        ← FF / FANTASY
      </a>

      <p className="eyebrow mt-10">
        Live standings
      </p>

      <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="section-title">
          Leaderboard.
        </h1>

        <div>
          <label
            htmlFor="leaderboard-day"
            className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground"
          >
            View
          </label>

          <select
            id="leaderboard-day"
            value={selectedDay}
            onChange={(event) => setSelectedDay(event.target.value)}
            className="border border-border bg-background px-4 py-3 text-sm outline-none"
          >
            <option value="">
              Global
            </option>

            {days.map((day) => (
              <option key={day.id} value={day.id}>
                {day.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state && (
        <p className="mt-8 text-muted-foreground">
          {state}
        </p>
      )}

      {/* YOUR RANKING */}
      {currentUserRow && (
        <div className="mt-8 border border-primary bg-primary/5 px-5 py-5">
          <p className="eyebrow">
            Your ranking
          </p>

          <div className="mt-3 grid grid-cols-[56px_1fr_100px] items-center gap-4">
            <span className="font-mono font-bold text-primary">
              #{currentUserRow.rank || rows.indexOf(currentUserRow) + 1}
            </span>

            <strong className="font-mono uppercase text-primary">
              {currentUserRow.username}
            </strong>

            <span className="text-right font-mono font-bold">
              {currentUserRow.points ?? 0}{' '}
              <small className="text-muted-foreground">
                PTS
              </small>
            </span>
          </div>
        </div>
      )}

      {/* FULL LEADERBOARD */}
      <div className="mt-10 border-t border-border">
        {rows.map((row, i) => {
          const teamId = row.fantasy_team_id

          const isCurrentUser =
            currentUser !== null &&
            (
              Number(row.user_id) === Number(currentUser.id) ||
              row.username === currentUser.username
            )

          const rowContent = (
            <>
              <span
                className={
                  isCurrentUser
                    ? 'font-mono font-bold text-primary'
                    : i < 3
                      ? 'font-mono text-primary'
                      : 'font-mono text-muted-foreground'
                }
              >
                #{row.rank || i + 1}
              </span>

              <strong
                className={
                  isCurrentUser
                    ? 'font-mono uppercase text-primary'
                    : 'font-mono uppercase'
                }
              >
                {row.username || 'Player'}
              </strong>

              <span className="text-right font-mono">
                {row.points ?? 0}{' '}
                <small className="text-muted-foreground">
                  PTS
                </small>
              </span>
            </>
          )

          const rowClassName = `
            grid grid-cols-[56px_1fr_100px]
            items-center
            gap-4
            border-b
            border-border
            py-5
            ${isCurrentUser
              ? 'bg-primary/10'
              : 'hover:text-primary'}
          `

          if (teamId) {
            return (
              <Link
                href={`/fantasy-team/${teamId}`}
                key={teamId || row.user_id || i}
                className={rowClassName}
              >
                {rowContent}
              </Link>
            )
          }

          return (
            <div
              key={row.user_id || i}
              className={rowClassName}
            >
              {rowContent}
            </div>
          )
        })}
      </div>
    </main>
  )
}
