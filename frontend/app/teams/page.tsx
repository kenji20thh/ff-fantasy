'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'
import type { Team } from '@/lib/types'

function TeamLogo({ teamId, teamName }: { teamId: number; teamName: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <div className="h-14 w-14 shrink-0 rounded-full border border-border" />
  }

  return (
    <img
      src={`/logos/${teamId}.png`}
      alt={`${teamName} logo`}
      onError={() => setFailed(true)}
      className="h-14 w-14 object-contain"
    />
  )
}

export default function Teams() {
  const [data, setData] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .teams()
      .then(x => setData(asArray<Team>(x)))
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <Link href="/" className="eyebrow">
        ← FF / FANTASY
      </Link>

      <h1 className="section-title mt-8">Tournament teams.</h1>

      {loading && (
        <p className="mt-10 text-muted-foreground">
          Loading teams…
        </p>
      )}

      {error && (
        <p className="mt-10 text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && !data.length && (
        <p className="mt-10 text-muted-foreground">
          No teams available yet.
        </p>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map(team => (
          <Link
            href={`/teams/${team.id}`}
            key={team.id}
            className="border border-border bg-card p-6 transition hover:border-primary"
          >
            <p className="eyebrow">Team {team.id}</p>

            <div className="mt-6 flex items-center gap-4">
              <TeamLogo teamId={team.id} teamName={team.name} />

              <h2 className="font-mono text-xl font-bold uppercase">
                {team.name}
              </h2>
            </div>

            <span className="mt-8 block text-xs text-muted-foreground">
              View players →
            </span>
          </Link>
        ))}
      </div>
    </main>
  )
}