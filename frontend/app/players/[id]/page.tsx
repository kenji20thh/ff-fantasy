'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { api } from '@/lib/api'
import { errorMessage } from '@/lib/types'
import type {
  PlayerStatsResponse,
  PlayerDayStats,
  PlayerRoomStat,
} from '@/lib/types'

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>()

  const [data, setData] = useState<PlayerStatsResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const playerId = Number(id)

    if (!playerId) {
      setError('Invalid player ID')
      return
    }

    api.playerStats(playerId)
      .then(response => {
        setData(response as PlayerStatsResponse)
      })
      .catch(error => {
        setError(errorMessage(error))
      })
  }, [id])

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
        <Link href="/teams" className="eyebrow">
          ← Teams
        </Link>

        <p className="mt-8 text-red-400">
          {error}
        </p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
        <p className="text-muted-foreground">
          Loading player...
        </p>
      </main>
    )
  }

  const { player, days, total } = data

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
      <Link href="/teams" className="eyebrow">
        ← Teams
      </Link>

      <header className="mt-8">
        <p className="text-sm text-muted-foreground">
          Player #{player.id}
        </p>

        <h1 className="section-title mt-2">
          {player.nickname}
        </h1>
      </header>

      {/* Overall total */}
      <section className="mt-10">
        <h2 className="text-lg font-bold uppercase">
          Overall
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Kills" value={total.kills} />
          <StatCard label="Assists" value={total.assists} />
          <StatCard label="First Blood" value={total.first_blood} />
          <StatCard label="Points" value={total.points} />
        </div>
      </section>

      {/* Tournament days */}
      <section className="mt-12">
        <h2 className="text-lg font-bold uppercase">
          Tournament Days
        </h2>

        <div className="mt-6 space-y-10">
          {days.map(day => (
            <DaySection key={day.id} day={day} />
          ))}
        </div>

        {!days.length && (
          <p className="mt-6 text-muted-foreground">
            No statistics available yet.
          </p>
        )}
      </section>
    </main>
  )
}

function DaySection({ day }: { day: PlayerDayStats }) {
  return (
    <section className="border-t border-border pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">
          {day.name}
        </h3>

        <span className="text-sm text-muted-foreground">
          {day.total?.points ?? day.total.points} pts
        </span>
      </div>

      {/* Rooms */}
      <div className="mt-5 space-y-3">
        {day.rooms.map(room => (
          <RoomCard key={room.room_id} room={room} />
        ))}
      </div>

      {/* Day total */}
      <div className="mt-6 rounded-lg border border-border p-5">
        <h4 className="text-sm font-bold uppercase text-muted-foreground">
          Day Total
        </h4>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Kills" value={day.total.kills} />
          <StatCard label="Assists" value={day.total.assists} />
          <StatCard label="First Blood" value={day.total.first_blood} />
          <StatCard label="Points" value={day.total.points} />
        </div>
      </div>
    </section>
  )
}

function RoomCard({ room }: { room: PlayerRoomStat }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="font-bold">
          Room {room.room_number}
        </p>

        <p className="mt-1 text-sm text-muted-foreground">
          {room.kills} kills · {room.assists} assists
          {room.first_blood ? ' · First Blood' : ''}
        </p>
      </div>

      <div className="text-right">
        <p className="text-lg font-bold">
          {room.points}
        </p>

        <p className="text-xs text-muted-foreground">
          points
        </p>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs uppercase text-muted-foreground">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>
    </div>
  )
}

