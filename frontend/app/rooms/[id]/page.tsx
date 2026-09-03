'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'
import type { RoomStats } from '@/lib/types'

export default function Room() {
  const { id } = useParams<{ id: string }>()

  const [s, setS] = useState<RoomStats[]>([])
  const [e, setE] = useState('Loading room statistics…')

  useEffect(() => {
    api.roomStats(Number(id))
      .then(x => {
        setS(asArray<RoomStats>(x))
        setE('')
      })
      .catch(x => setE(errorMessage(x)))
  }, [id])

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <Link href="/schedule" className="eyebrow">
        ← Schedule
      </Link>

      <h1 className="section-title mt-10">
        Room {((Number(id) - 1) % 6) + 1} stats.
      </h1>

      {e && (
        <p className="mt-8 text-muted-foreground">
          {e}
        </p>
      )}

      <div className="mt-10 overflow-x-auto border-y border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
              <th className="p-4">Player</th>
              <th className="p-4">Kills</th>
              <th className="p-4">Assists</th>
              <th className="p-4">First blood</th>
              <th className="p-4">Placement</th>
              <th className="p-4">Points</th>
            </tr>
          </thead>

          <tbody>
            {s.map(x => (
              <tr
                key={x.player_id}
                className="border-b border-border"
              >
                <td className="p-4 font-mono">
                  {x.player?.nickname || `Player ${x.player_id}`}
                </td>

                <td className="p-4">
                  {x.kills}
                </td>

                <td className="p-4">
                  {x.assists}
                </td>

                <td className="p-4">
                  {x.first_blood ? 'Yes' : '—'}
                </td>

                <td className="p-4">
                  {x.placement}
                </td>

                <td className="p-4 font-bold text-primary">
                  {x.points ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}