'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { asArray, errorMessage } from '@/lib/types'
import type { Player, Team } from '@/lib/types'

export default function FantasyTeam() {
  const { user } = useAuth()

  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<Player[]>([])
  const [captain, setCaptain] = useState<number>()
  const [fantasyId, setFantasyId] = useState<number>()
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.teams()
      .then(x => {
        const ts = asArray<Team>(x)
        setTeams(ts)

        return Promise.all(
          ts.map(t => api.players(t.id))
        )
      })
      .then(xs => {
        setPlayers(
          xs.flatMap(x => asArray<Player>(x))
        )
      })
      .catch(e => setMessage(errorMessage(e)))
  }, [])

  function toggle(p: Player) {
    if (selected.some(x => x.id === p.id)) {
      setSelected(
        selected.filter(x => x.id !== p.id)
      )

      if (captain === p.id) {
        setCaptain(undefined)
      }

      return
    }

    if (selected.length >= 4) {
      setMessage('You can only select four players.')
      return
    }

    if (selected.some(x => x.team_id === p.team_id)) {
      setMessage(
        'Choose four players from four different teams.'
      )
      return
    }

    setSelected([...selected, p])
    setMessage('')
  }

  async function save() {
    try {
      if (!user) {
        throw Error('Sign in before saving your fantasy team.')
      }

      if (selected.length !== 4) {
        throw Error('Select exactly four players.')
      }

      const team = fantasyId
        ? { fantasy_team_id: fantasyId }
        : await api.createFantasy(user.id) as { fantasy_team_id: number }

      setFantasyId(team.fantasy_team_id)

      await api.selectPlayers(
        team.fantasy_team_id,
        {
          player_ids: selected.map(p => p.id),
        }
      )

      if (captain) {
        await api.captain(
          team.fantasy_team_id,
          captain
        )
      }

      setMessage('Fantasy team saved successfully.')
    } catch (e) {
      setMessage(errorMessage(e))
    }
  }

  const visiblePlayers = players.filter(
    p =>
      selectedTeam === null ||
      p.team_id === selectedTeam
  )

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <a href="/" className="eyebrow">
        ← FF / FANTASY
      </a>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            Fantasy builder
          </p>

          <h1 className="section-title">
            Draft your squad.
          </h1>
        </div>

        <span className="font-mono text-sm text-primary">
          {selected.length} / 4 selected
        </span>
      </div>

      {message && (
        <p className="mt-6 border border-primary/40 bg-card p-4 text-sm">
          {message}
        </p>
      )}

      {/* Team filter */}
      <div className="mt-8">
        <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">
          Select a team
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedTeam(null)}
            className={`border px-4 py-2 text-sm font-bold ${
              selectedTeam === null
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card'
            }`}
          >
            All Teams
          </button>

          {teams.map(team => (
            <button
              type="button"
              key={team.id}
              onClick={() => {
                setSelectedTeam(team.id)
                setMessage('')
              }}
              className={`border px-4 py-2 text-sm font-bold ${
                selectedTeam === team.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card'
              }`}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      {/* Players */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visiblePlayers.map(p => {
          const isSelected = selected.some(
            x => x.id === p.id
          )

          return (
            <button
              type="button"
              key={p.id}
              onClick={() => toggle(p)}
              className={`border p-5 text-left ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card'
              }`}
            >
              <span className="text-xs text-muted-foreground">
                Team {teams.find(
                  t => t.id === p.team_id
                )?.name || p.team_id}
              </span>

              <strong className="mt-5 block font-mono uppercase">
                {p.nickname}
              </strong>

              {isSelected && (
                <span className="mt-3 block text-xs font-bold uppercase text-primary">
                  Selected
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Captain */}
      <section className="mt-12 border-t border-border pt-8">
        <h2 className="font-mono text-lg font-bold uppercase">
          Captain
        </h2>

        <div className="mt-4 flex flex-wrap gap-4">
          {selected.map(p => (
            <label
              key={p.id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="captain"
                checked={captain === p.id}
                onChange={() => setCaptain(p.id)}
              />

              {p.nickname}
            </label>
          ))}
        </div>

        <button
          onClick={save}
          className="mt-8 bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          Save fantasy team
        </button>
      </section>
    </main>
  )
}

