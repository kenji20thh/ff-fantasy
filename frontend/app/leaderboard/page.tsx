'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'
import type { LeaderboardEntry, TournamentDay } from '@/lib/types'

export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [days, setDays] = useState<TournamentDay[]>([])
  const [selectedDay, setSelectedDay] = useState('')
  const [state, setState] = useState('Loading leaderboard…')

  useEffect(() => {
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

      <div className="mt-10 border-t border-border">
        {rows.map((row, i) => (
          <div
            key={row.fantasy_team_id || row.user_id || i}
            className="grid grid-cols-[56px_1fr_100px] items-center gap-4 border-b border-border py-5"
          >
            <span
              className={
                i < 3
                  ? 'font-mono text-primary'
                  : 'font-mono text-muted-foreground'
              }
            >
              #{row.rank || i + 1}
            </span>

            <strong className="font-mono uppercase">
              {row.username || 'Player'}
            </strong>

            <span className="text-right font-mono">
              {row.points ?? 0}{' '}
              <small className="text-muted-foreground">
                PTS
              </small>
            </span>
          </div>
        ))}
      </div>
    </main>
  )
}