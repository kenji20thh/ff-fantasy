'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { api } from '@/lib/api'
import { asArray, dateLabel, errorMessage } from '@/lib/types'

import type { TournamentDay } from '@/lib/types'

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
        {days.map(day => (
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