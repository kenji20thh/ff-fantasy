'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { api } from '@/lib/api'
import { asArray, dateLabel, errorMessage } from '@/lib/types'

import type { TournamentDay } from '@/lib/types'

type Phase = 'league' | 'rush' | 'final' | 'unknown'

const PHASE_ORDER: Record<Phase, number> = {
  league: 0,
  rush: 1,
  final: 2,
  unknown: 99,
}

function parseDayName(name: string): { phase: Phase; week?: number; day?: number } {
  const league = name.match(/^week\s*(\d+)\s*day\s*(\d+)/i)
  if (league) {
    return { phase: 'league', week: Number(league[1]), day: Number(league[2]) }
  }

  const rush = name.match(/^rush\s*day\s*(\d+)/i)
  if (rush) {
    return { phase: 'rush', day: Number(rush[1]) }
  }

  const final = name.match(/^(grand\s*)?final\s*day\s*(\d+)/i)
  if (final) {
    return { phase: 'final', day: Number(final[1]) }
  }

  return { phase: 'unknown' }
}

export default function Schedule() {
  const [days, setDays] = useState<TournamentDay[]>([])
  const [error, setError] = useState('Loading tournament schedule…')

  useEffect(() => {
    api.days()
      .then(data => {
        setDays(asArray<TournamentDay>(data))
        setError('')
      })
      .catch(err => {
        setError(errorMessage(err))
      })
  }, [])

  const sortedDays = useMemo(() => {
    return [...days].sort((a, b) => {
      const pa = parseDayName(a.name)
      const pb = parseDayName(b.name)

      if (PHASE_ORDER[pa.phase] !== PHASE_ORDER[pb.phase]) {
        return PHASE_ORDER[pa.phase] - PHASE_ORDER[pb.phase]
      }

      const weekA = pa.week ?? 0
      const weekB = pb.week ?? 0
      if (weekA !== weekB) return weekA - weekB

      const dayA = pa.day ?? 0
      const dayB = pb.day ?? 0
      return dayA - dayB
    })
  }, [days])

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <Link href="/" className="eyebrow">
        ← FF / FANTASY
      </Link>

      <p className="eyebrow mt-10">
        Tournament calendar
      </p>

      <h1 className="section-title">
        Match days.
      </h1>

      {error && (
        <p className="mt-8 text-muted-foreground">
          {error}
        </p>
      )}

      <div className="mt-10 divide-y divide-border border-y border-border">
        {sortedDays.map(day => (
          <div
            key={day.id}
            className="flex flex-wrap items-center justify-between gap-4 py-6"
          >
            <Link
              href={`/schedule/${day.id}`}
              className="font-mono text-lg font-bold uppercase hover:text-primary"
            >
              {day.name}
            </Link>

            <div className="flex items-center gap-6">
              <span className="text-sm text-muted-foreground">
                Deadline {dateLabel(day.deadline_at)}
              </span>

              <Link
                href={`/players?day=${day.id}`}
                className="text-sm font-semibold hover:text-primary"
              >
                Player Rankings →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}