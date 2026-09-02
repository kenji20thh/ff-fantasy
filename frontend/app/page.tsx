'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import { asArray, dateLabel, errorMessage } from '@/lib/types'
import type {
  Team,
  TournamentDay,
  LeaderboardEntry,
} from '@/lib/types'

import {
  Empty,
  Loading,
  Notice,
  PageTitle,
  buttonClass,
} from '@/components/app-shell'

type MyFantasyTeam = {
  id: number
}

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([])
  const [days, setDays] = useState<TournamentDay[]>([])
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([])
  const [myFantasyTeam, setMyFantasyTeam] =
    useState<MyFantasyTeam | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.teams(),
      api.days(),
      api.leaderboard(),
      api.myFantasyTeam().catch(error => {
        const apiError = error as { status?: number }

        if (apiError.status === 404) {
          return null
        }

        throw error
      }),
    ])
      .then(([t, d, l, fantasyTeam]) => {
        setTeams(asArray<Team>(t))
        setDays(asArray<TournamentDay>(d))
        setLeaders(asArray<LeaderboardEntry>(l))
        setMyFantasyTeam(
          fantasyTeam as MyFantasyTeam | null
        )
      })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-32">
          <p className="eyebrow">
            Free Fire fantasy competition
          </p>

          <h1 className="mt-5 max-w-5xl font-mono text-6xl font-bold uppercase leading-[.9] tracking-[-.08em] sm:text-8xl">
            Build the squad.
            <br />
            <span className="text-primary">
              Own the room.
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-7 text-muted-foreground">
            Pick four players from four different tournament
            teams, name your captain, and compete on the official
            FF Fantasy leaderboard.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {myFantasyTeam ? (
              <Link
                href={`/fantasy-team/${myFantasyTeam.id}`}
                className={buttonClass}
              >
                View My Team
              </Link>
            ) : (
              <Link
                href="/fantasy-team/builder"
                className={buttonClass}
              >
                Build your fantasy team
              </Link>
            )}

            <Link
              href="/schedule"
              className="border border-border px-5 py-3 text-xs font-bold uppercase tracking-widest"
            >
              View schedule
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {error && <Notice kind="error">{error}</Notice>}

        {loading ? (
          <Loading label="Loading live tournament data..." />
        ) : (
          <div className="grid gap-12 lg:grid-cols-3">
            <section>
              <PageTitle eyebrow="Competition" title="Teams" />

              <div className="mt-6 space-y-2">
                {teams.length ? (
                  teams.slice(0, 6).map(t => (
                    <Link
                      className="flex justify-between border border-border bg-card p-4 hover:border-primary"
                      href={`/teams/${t.id}`}
                      key={t.id}
                    >
                      <span>{t.name}</span>
                      <span className="text-primary">→</span>
                    </Link>
                  ))
                ) : (
                  <Empty label="No teams published yet." />
                )}
              </div>

              <Link
                className="mt-5 inline-block text-xs uppercase tracking-widest text-primary"
                href="/teams"
              >
                All teams →
              </Link>
            </section>

            <section>
              <PageTitle eyebrow="Upcoming" title="Schedule" />

              <div className="mt-6 space-y-2">
                {days.length ? (
                  days.slice(0, 5).map(d => (
                    <Link
                      className="block border border-border bg-card p-4 hover:border-primary"
                      href={`/schedule/${d.id}`}
                      key={d.id}
                    >
                      <p className="font-bold">{d.name}</p>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Deadline {dateLabel(d.deadline_at)}
                      </p>
                    </Link>
                  ))
                ) : (
                  <Empty label="No tournament days published yet." />
                )}
              </div>

              <Link
                className="mt-5 inline-block text-xs uppercase tracking-widest text-primary"
                href="/schedule"
              >
                Full schedule →
              </Link>
            </section>

            <section>
              <PageTitle eyebrow="Live data" title="Leaderboard" />

              <div className="mt-6 border-t border-border">
                {leaders.length ? (
                  leaders.slice(0, 6).map((x, i) => (
                    <div
                      className="flex justify-between border-b border-border py-4"
                      key={String(
                        x.user_id ?? x.username ?? i
                      )}
                    >
                      <span>
                        <b className="mr-4 text-primary">
                          {x.rank ?? i + 1}
                        </b>

                        {x.username ?? 'Unknown player'}
                      </span>

                      <b>
                        {x.points ?? 0}{' '}
                        <small className="text-muted-foreground">
                          PTS
                        </small>
                      </b>
                    </div>
                  ))
                ) : (
                  <Empty label="No leaderboard data yet." />
                )}
              </div>

              <Link
                className="mt-5 inline-block text-xs uppercase tracking-widest text-primary"
                href="/leaderboard"
              >
                Full leaderboard →
              </Link>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}