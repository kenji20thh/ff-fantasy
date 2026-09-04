'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'
import type { KillsEntry, TournamentDay } from '@/lib/types'

export default function DayKills() {
  const { id } = useParams<{ id: string }>()

  const [day, setDay] = useState<TournamentDay>()
  const [kills, setKills] = useState<KillsEntry[]>([])
  const [error, setError] = useState('Loading kills…')

  useEffect(() => {
    const dayId = Number(id)

    Promise.all([api.day(dayId), api.dayKills(dayId)])
      .then(([d, k]) => {
        setDay(d as TournamentDay)
        setKills(asArray<KillsEntry>(k))
        setError('')
      })
      .catch(x => setError(errorMessage(x)))
  }, [id])

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10">
      <Link href={`/schedule/${id}`} className="eyebrow">
        ← {day?.name || `Day ${id}`}
      </Link>

      <h1 className="section-title mt-10">
        Kills — {day?.name || `Day ${id}`}
      </h1>

      {error && (
        <p className="mt-8 text-muted-foreground">
          {error}
        </p>
      )}

      {!error && kills.length === 0 && (
        <p className="mt-8 text-muted-foreground">
          No stats recorded for this day yet.
        </p>
      )}

      {kills.length > 0 && (
        <div className="mt-10 overflow-x-auto border-y border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                <th className="p-4">#</th>
                <th className="p-4">Player</th>
                <th className="p-4">Team</th>
                <th className="p-4">Kills</th>
              </tr>
            </thead>

            <tbody>
              {kills.map((k, i) => (
                <tr key={k.player_id} className="border-b border-border">
                  <td className="p-4 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="p-4 font-mono">{k.nickname}</td>
                  <td className="p-4 text-muted-foreground">{k.team_name}</td>
                  <td className="p-4 font-bold text-primary">{k.kills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}