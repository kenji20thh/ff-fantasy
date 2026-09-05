'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'

import type { PlayerRanking, TournamentDay } from '@/lib/types'

function PlayersContent() {
  const searchParams = useSearchParams()

  const [days, setDays] = useState<TournamentDay[]>([])
  const [players, setPlayers] = useState<PlayerRanking[]>([])
  const [selectedDay, setSelectedDay] = useState(
    searchParams.get('day') ?? ''
  )
  const [sort, setSort] = useState<'points' | 'kills'>('points')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.days()
      .then(data => {
        setDays(asArray<TournamentDay>(data))
      })
      .catch(err => {
        setError(errorMessage(err))
      })
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')

    const dayId = selectedDay
      ? Number(selectedDay)
      : undefined

    api.playerRankings(dayId, sort)
      .then(data => {
        setPlayers(asArray<PlayerRanking>(data))
      })
      .catch(err => {
        setError(errorMessage(err))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [selectedDay, sort])

  function handleDayChange(value: string) {
    setSelectedDay(value)

    const url = new URL(window.location.href)

    if (value) {
      url.searchParams.set('day', value)
    } else {
      url.searchParams.delete('day')
    }

    window.history.replaceState({}, '', url)
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <Link href="/" className="eyebrow">
        ← FF / FANTASY
      </Link>

      <p className="eyebrow mt-10">
        Player statistics
      </p>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="section-title">
            Player rankings.
          </h1>

          <p className="mt-3 text-muted-foreground">
            Compare player performance across the tournament.
          </p>
        </div>

        <Link
          href="/schedule"
          className="text-sm font-semibold hover:text-primary"
        >
          Tournament Schedule →
        </Link>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <select
          value={selectedDay}
          onChange={event => handleDayChange(event.target.value)}
          className="border border-border bg-background px-4 py-3 text-sm font-medium outline-none focus:border-primary"
        >
          <option value="">
            All Days
          </option>

          {days.map(day => (
            <option key={day.id} value={day.id}>
              {day.name}
            </option>
          ))}
        </select>

        <div className="flex border border-border">
          <button
            type="button"
            onClick={() => setSort('points')}
            className={`px-5 py-3 text-sm font-semibold transition ${
              sort === 'points'
                ? 'bg-foreground text-background'
                : 'hover:bg-muted'
            }`}
          >
            Points
          </button>

          <button
            type="button"
            onClick={() => setSort('kills')}
            className={`px-5 py-3 text-sm font-semibold transition ${
              sort === 'kills'
                ? 'bg-foreground text-background'
                : 'hover:bg-muted'
            }`}
          >
            Kills
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-8 text-muted-foreground">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-muted-foreground">
          Loading player rankings…
        </p>
      ) : (
        <div className="mt-10 border-y border-border">
          <div className="grid grid-cols-[50px_1fr_auto] gap-4 border-b border-border px-4 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground md:grid-cols-[60px_1fr_180px_120px]">
            <span>#</span>
            <span>Player</span>
            <span className="hidden md:block">Team</span>
            <span className="text-right">
              {sort === 'points' ? 'Points' : 'Kills'}
            </span>
          </div>

          {players.length === 0 ? (
            <div className="px-4 py-10 text-center text-muted-foreground">
              No player statistics available.
            </div>
          ) : (
            players.map((player, index) => (
              <div
                key={player.player_id}
                className="grid grid-cols-[50px_1fr_auto] items-center gap-4 border-b border-border px-4 py-5 last:border-b-0 md:grid-cols-[60px_1fr_180px_120px]"
              >
                <span className="font-mono text-sm text-muted-foreground">
                  {index + 1}
                </span>

                <div className="flex min-w-0 items-center gap-4">
                  {player.picture_url ? (
                    <img
                      src={player.picture_url}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-full border border-border" />
                  )}

                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {player.nickname}
                    </p>

                    <p className="truncate text-sm text-muted-foreground md:hidden">
                      {player.team_name}
                    </p>
                  </div>
                </div>

                <span className="hidden truncate text-sm text-muted-foreground md:block">
                  {player.team_name}
                </span>

                <span className="text-right font-mono text-lg font-bold">
                  {sort === 'points'
                    ? player.points
                    : player.kills}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  )
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PlayersContent />
    </Suspense>
  )
}