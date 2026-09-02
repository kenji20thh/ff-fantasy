
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'

import type {
  Player,
  Team,
} from '@/lib/types'

type FantasyTeamResponse = {
  id: number
  user_id: number
  player_ids?: number[] | null
  captain_player_id?: number | null
}

type RoomScore = {
  room_id: number
  kills: number
  assists: number
  first_blood: boolean
  placement: number
  points: number
}

type PlayerScore = {
  player_id: number
  captain: boolean
  rooms: RoomScore[]
  total_points: number
}

type FantasyPointsResponse = {
  fantasy_team_id: number
  total_points: number
  players: PlayerScore[]
}

export default function FantasyTeamDetails() {
  const { id } = useParams<{ id: string }>()

  const [fantasyTeam, setFantasyTeam] =
    useState<FantasyTeamResponse | null>(null)

  const [points, setPoints] =
    useState<FantasyPointsResponse | null>(null)

  const [teams, setTeams] =
    useState<Team[]>([])

  const [players, setPlayers] =
    useState<Player[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  useEffect(() => {
    const fantasyTeamID = Number(id)

    if (!fantasyTeamID) {
      setError('Invalid fantasy team ID.')
      setLoading(false)
      return
    }

    async function load() {
      try {
        const [fantasyResponse, pointsResponse, teamsResponse] =
          await Promise.all([
            api.fantasy(fantasyTeamID),
            api.fantasyPoints(fantasyTeamID),
            api.teams(),
          ])

        const fantasy = fantasyResponse as FantasyTeamResponse
        const fantasyPoints =
          pointsResponse as FantasyPointsResponse

        const loadedTeams =
          asArray<Team>(teamsResponse)

        setFantasyTeam(fantasy)
        setPoints(fantasyPoints)
        setTeams(loadedTeams)

        const loadedPlayers = await Promise.all(
          loadedTeams.map(team =>
            api.players(team.id)
          )
        )

        setPlayers(
          loadedPlayers.flatMap(response =>
            asArray<Player>(response)
          )
        )
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <Link href="/fantasy-team" className="eyebrow">
          ← My Fantasy Team
        </Link>

        <p className="mt-12 text-muted-foreground">
          Loading fantasy team...
        </p>
      </main>
    )
  }

  if (error || !fantasyTeam) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <Link href="/fantasy-team" className="eyebrow">
          ← My Fantasy Team
        </Link>

        <p className="mt-12 border border-red-500/40 bg-card p-4 text-sm text-red-400">
          {error || 'Fantasy team not found.'}
        </p>
      </main>
    )
  }

  const selectedPlayers = (fantasyTeam.player_ids ?? [])
    .map(playerID =>
      players.find(player => player.id === playerID)
    )
    .filter(
      (player): player is Player =>
        player !== undefined
    )

  const getPlayerScore = (playerID: number) =>
    points?.players.find(
      player => player.player_id === playerID
    )

  const getTeamName = (teamID: number) =>
    teams.find(team => team.id === teamID)?.name ||
    `Team ${teamID}`

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      <Link href="/fantasy-team" className="eyebrow">
        ← My Fantasy Team
      </Link>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">
            Fantasy team #{fantasyTeam.id}
          </p>

          <h1 className="section-title mt-2">
            Your squad.
          </h1>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase text-muted-foreground">
            Total points
          </p>

          <p className="font-mono text-4xl font-bold text-primary">
            {points?.total_points ?? 0}
          </p>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="font-mono text-lg font-bold uppercase">
            Players
          </h2>

          <span className="text-xs text-muted-foreground">
            {selectedPlayers.length} / 4
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {selectedPlayers.map(player => {
            const score = getPlayerScore(player.id)

            const isCaptain =
              fantasyTeam.captain_player_id === player.id

            return (
              <div
                key={player.id}
                className={`border p-5 ${
                  isCaptain
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {getTeamName(player.team_id)}
                  </span>

                  {isCaptain && (
                    <span className="text-xs font-bold uppercase text-primary">
                      Captain
                    </span>
                  )}
                </div>

                <strong className="mt-5 block font-mono text-lg uppercase">
                  {player.nickname}
                </strong>

                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Points
                  </p>

                  <p className="mt-1 font-mono text-2xl font-bold">
                    {score?.total_points ?? 0}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {!selectedPlayers.length && (
          <p className="mt-6 text-sm text-muted-foreground">
            No players have been selected yet.
          </p>
        )}
      </section>

      {points?.players && points.players.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-mono text-lg font-bold uppercase">
            Room scores
          </h2>

          <div className="mt-6 space-y-8">
            {selectedPlayers.map(player => {
              const score = getPlayerScore(player.id)

              if (!score || !score.rooms.length) {
                return null
              }

              return (
                <div key={player.id}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono font-bold uppercase">
                      {player.nickname}
                    </h3>

                    <span className="text-sm text-muted-foreground">
                      {score.total_points} points
                    </span>
                  </div>

                  <div className="mt-3 overflow-x-auto border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-card">
                        <tr>
                          <th className="px-4 py-3">
                            Room
                          </th>

                          <th className="px-4 py-3">
                            Kills
                          </th>

                          <th className="px-4 py-3">
                            Assists
                          </th>

                          <th className="px-4 py-3">
                            First Blood
                          </th>

                          <th className="px-4 py-3">
                            Placement
                          </th>

                          <th className="px-4 py-3">
                            Points
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {score.rooms.map(room => (
                          <tr
                            key={room.room_id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-mono">
                              #{room.room_id}
                            </td>

                            <td className="px-4 py-3">
                              {room.kills}
                            </td>

                            <td className="px-4 py-3">
                              {room.assists}
                            </td>

                            <td className="px-4 py-3">
                              {room.first_blood ? 'Yes' : 'No'}
                            </td>

                            <td className="px-4 py-3">
                              {room.placement || '-'}
                            </td>

                            <td className="px-4 py-3 font-bold">
                              {room.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}

