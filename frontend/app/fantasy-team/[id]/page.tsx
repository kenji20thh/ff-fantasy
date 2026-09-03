'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import { api } from '@/lib/api'
import { asArray, errorMessage } from '@/lib/types'

import type {
Player,
Team,
TournamentDay,
} from '@/lib/types'

type FantasyDaySelection = {
id: number
day_id: number
day_name: string
player_ids: number[]
captain_player_id?: number | null
}

type FantasyTeamResponse = {
id: number
user_id: number
day_id?: number | null
player_ids?: number[] | null
captain_player_id?: number | null
days?: FantasyDaySelection[]
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

const [days, setDays] =
useState<TournamentDay[]>([])

const [selectedDay, setSelectedDay] =
useState<TournamentDay | null>(null)

const [teams, setTeams] =
useState<Team[]>([])

const [dayPlayers, setDayPlayers] =
useState<Player[]>([])

const [selected, setSelected] =
useState<Player[]>([])

const [captain, setCaptain] =
useState<number | null>(null)

const [selectedTeam, setSelectedTeam] =
useState<number | null>(null)

const [loading, setLoading] =
useState(true)

const [loadingDay, setLoadingDay] =
useState(false)

const [saving, setSaving] =
useState(false)

const [error, setError] =
useState('')

const [message, setMessage] =
useState('')

function isDayLocked(day: TournamentDay) {
if (!day.deadline_at) {
return false
}

return new Date(day.deadline_at).getTime() <= Date.now()


}

function getDaySelection(
dayID: number,
fantasy: FantasyTeamResponse | null = fantasyTeam
) {
return fantasy?.days?.find(
selection => selection.day_id === dayID
)
}

function getTeamName(teamID: number) {
return (
teams.find(team => team.id === teamID)?.name ||
`Team ${teamID}`
)
}

function getPlayerScore(playerID: number) {
return points?.players.find(
player => player.player_id === playerID
)
}

function getParticipatingTeamIDs(day: TournamentDay) {
return new Set(
(day.teams ?? []).map(team =>
typeof team === 'number'
? team
: team.id
)
)
}

async function loadDay(
day: TournamentDay,
fantasy: FantasyTeamResponse,
availableTeams: Team[]
) {
try {
setLoadingDay(true)
setMessage('')
setSelectedTeam(null)

  const participatingTeamIDs =
    getParticipatingTeamIDs(day)

  const dayTeams = availableTeams.filter(team =>
    participatingTeamIDs.has(team.id)
  )

  const playerResponses = await Promise.all(
    dayTeams.map(team =>
      api.players(team.id)
    )
  )

  const loadedDayPlayers =
    playerResponses.flatMap(response =>
      asArray<Player>(response)
    )

  setDayPlayers(loadedDayPlayers)

  const selection =
    fantasy.days?.find(
      item => item.day_id === day.id
    )

  if (!selection) {
    setSelected([])
    setCaptain(null)
    return
  }

  const selectedPlayers =
    selection.player_ids
      .map(playerID =>
        loadedDayPlayers.find(
          player => player.id === playerID
        )
      )
      .filter(
        (player): player is Player =>
          player !== undefined
      )

  setSelected(selectedPlayers)

  setCaptain(
    selection.captain_player_id ?? null
  )
} catch (e) {
  setMessage(errorMessage(e))
  setSelected([])
  setCaptain(null)
} finally {
  setLoadingDay(false)
}

}

useEffect(() => {
const fantasyTeamID = Number(id)

if (!fantasyTeamID) {
  setError('Invalid fantasy team ID.')
  setLoading(false)
  return
}

async function load() {
  try {
    const [
      fantasyResponse,
      pointsResponse,
      daysResponse,
      teamsResponse,
    ] = await Promise.all([
      api.fantasy(fantasyTeamID),
      api.fantasyPoints(fantasyTeamID),
      api.days(),
      api.teams(),
    ])

    const fantasy =
      fantasyResponse as FantasyTeamResponse

    const fantasyPoints =
      pointsResponse as FantasyPointsResponse

    const loadedDays =
      asArray<TournamentDay>(daysResponse)

    const loadedTeams =
      asArray<Team>(teamsResponse)

    setFantasyTeam(fantasy)
    setPoints(fantasyPoints)
    setDays(loadedDays)
    setTeams(loadedTeams)

    const firstOpenDay =
      loadedDays.find(
        day => !isDayLocked(day)
      ) ??
      loadedDays[loadedDays.length - 1]

    if (firstOpenDay) {
      setSelectedDay(firstOpenDay)

      const participatingTeamIDs =
        getParticipatingTeamIDs(
          firstOpenDay
        )

      const dayTeams =
        loadedTeams.filter(team =>
          participatingTeamIDs.has(
            team.id
          )
        )

      const playerResponses =
        await Promise.all(
          dayTeams.map(team =>
            api.players(team.id)
          )
        )

      const loadedDayPlayers =
        playerResponses.flatMap(
          response =>
            asArray<Player>(response)
        )

      setDayPlayers(
        loadedDayPlayers
      )

      const selection =
        fantasy.days?.find(
          item =>
            item.day_id ===
            firstOpenDay.id
        )

      if (selection) {
        const selectedPlayers =
          selection.player_ids
            .map(playerID =>
              loadedDayPlayers.find(
                player =>
                  player.id ===
                  playerID
              )
            )
            .filter(
              (player): player is Player =>
                player !== undefined
            )

        setSelected(
          selectedPlayers
        )

        setCaptain(
          selection.captain_player_id ??
            null
        )
      }
    }
  } catch (e) {
    setError(errorMessage(e))
  } finally {
    setLoading(false)
  }
}

load()

}, [id])

async function changeDay(day: TournamentDay) {
if (
loadingDay ||
selectedDay?.id === day.id ||
!fantasyTeam
) {
return
}

setSelectedDay(day)

await loadDay(
  day,
  fantasyTeam,
  teams
)

}

function togglePlayer(player: Player) {
if (!selectedDay) {
return
}

if (isDayLocked(selectedDay)) {
  setMessage(
    'This tournament day is locked.'
  )
  return
}

const alreadySelected =
  selected.some(
    item => item.id === player.id
  )

if (alreadySelected) {
  setSelected(
    selected.filter(
      item => item.id !== player.id
    )
  )

  if (captain === player.id) {
    setCaptain(null)
  }

  setMessage('')
  return
}

if (selected.length >= 4) {
  setMessage(
    'You can only select four players.'
  )
  return
}

const sameTeam =
  selected.some(
    item =>
      item.team_id ===
      player.team_id
  )

if (sameTeam) {
  setMessage(
    'Choose four players from four different teams.'
  )
  return
}

setSelected([
  ...selected,
  player,
])

setMessage('')

}

async function saveDay() {
if (!fantasyTeam || !selectedDay) {
return
}

try {
  if (isDayLocked(selectedDay)) {
    throw Error(
      'This tournament day is locked.'
    )
  }

  if (selected.length !== 4) {
    throw Error(
      'Select exactly four players.'
    )
  }

  if (!captain) {
    throw Error(
      'Choose a captain.'
    )
  }

  setSaving(true)
  setMessage('')

  const playerIDs =
    selected.map(
      player => player.id
    )

  await api.selectPlayers(
    fantasyTeam.id,
    {
      day_id: selectedDay.id,
      player_ids: playerIDs,
    }
  )

  await api.captain(
    fantasyTeam.id,
    selectedDay.id,
    captain
  )

  const existingSelection =
    getDaySelection(
      selectedDay.id
    )

  const newSelection:
    FantasyDaySelection = {
    id:
      existingSelection?.id ?? 0,

    day_id:
      selectedDay.id,

    day_name:
      selectedDay.name,

    player_ids:
      playerIDs,

    captain_player_id:
      captain,
  }

  const previousDays =
    fantasyTeam.days ?? []

  const updatedDays = [
    ...previousDays.filter(
      selection =>
        selection.day_id !==
        selectedDay.id
    ),
    newSelection,
  ].sort(
    (a, b) =>
      a.day_id - b.day_id
  )

  setFantasyTeam({
    ...fantasyTeam,
    days: updatedDays,
  })

  setMessage(
    `${selectedDay.name} saved successfully.`
  )
} catch (e) {
  setMessage(
    errorMessage(e)
  )
} finally {
  setSaving(false)
}

}

const selectedDayLocked =
selectedDay
? isDayLocked(selectedDay)
: false

const participatingTeamIDs =
selectedDay
? getParticipatingTeamIDs(
selectedDay
)
: new Set<number>()

const visiblePlayers =
dayPlayers.filter(
player =>
selectedTeam === null ||
player.team_id ===
selectedTeam
)

if (loading) {
return ( <main className="mx-auto min-h-screen max-w-6xl px-5 py-10"> <Link
       href="/fantasy-team"
       className="eyebrow"
     >
← My Fantasy Team </Link>

    <p className="mt-12 text-muted-foreground">
      Loading fantasy team...
    </p>
  </main>
)

}

if (error || !fantasyTeam) {
return ( <main className="mx-auto min-h-screen max-w-6xl px-5 py-10"> <Link
       href="/fantasy-team"
       className="eyebrow"
     >
← My Fantasy Team </Link>

    <p className="mt-12 border border-red-500/40 bg-card p-4 text-sm text-red-400">
      {error ||
        'Fantasy team not found.'}
    </p>
  </main>
)

}

return ( <main className="mx-auto min-h-screen max-w-6xl px-5 py-10"> <Link
     href="/fantasy-team"
     className="eyebrow"
   >
← My Fantasy Team </Link>

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

  <section className="mt-10 border border-border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tournament
        </p>

        <h2 className="mt-1 font-mono text-lg font-bold uppercase">
          Select day
        </h2>
      </div>

      {selectedDay && (
        <span className="font-mono text-sm font-bold text-primary">
          {selectedDay.name}
        </span>
      )}
    </div>

    <div className="mt-5 flex flex-wrap gap-3">
      {days.map(day => {
        const locked =
          isDayLocked(day)

        const active =
          selectedDay?.id ===
          day.id

        const selection =
          getDaySelection(
            day.id
          )

        return (
          <button
            key={day.id}
            type="button"
            disabled={
              loadingDay ||
              active
            }
            onClick={() =>
              changeDay(day)
            }
            className={`min-w-40 border px-5 py-4 text-left transition ${
              active
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:border-primary'
            } disabled:cursor-default`}
          >
            <p className="font-mono text-sm font-bold uppercase">
              {day.name}
            </p>

            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {locked ? (
                <span className="text-muted-foreground">
                  LOCKED
                </span>
              ) : (
                <span className="text-primary">
                  OPEN
                </span>
              )}

              {selection && (
                <span className="font-bold text-primary">
                  ✓ SQUAD
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  </section>

  {selectedDay && (
    <>
      <section className="mt-8 border-b border-border pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Current day
            </p>

            <h2 className="mt-2 font-mono text-2xl font-bold uppercase">
              {selectedDay.name}
            </h2>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase text-muted-foreground">
              Selection
            </p>

            <p className="font-mono text-xl font-bold text-primary">
              {selected.length}/4
            </p>
          </div>
        </div>

        {selectedDayLocked && (
          <div className="mt-5 border border-border bg-card p-4">
            <p className="font-bold uppercase">
              Day locked
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              This day's selection can no longer be changed.
            </p>
          </div>
        )}
      </section>

      {message && (
        <div className="mt-6 border border-primary/40 bg-card p-4">
          <p className="text-sm">
            {message}
          </p>
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Your selection
            </p>

            <h2 className="mt-1 font-mono text-lg font-bold uppercase">
              Players
            </h2>
          </div>

          <span className="font-mono text-sm text-primary">
            {selected.length}/4
          </span>
        </div>

        {selected.length === 0 ? (
          <div className="mt-5 border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              No players selected for this day.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {selected.map(player => {
              const isCaptain =
                captain ===
                player.id

              const score =
                getPlayerScore(
                  player.id
                )

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
                      {getTeamName(
                        player.team_id
                      )}
                    </span>

                    {isCaptain && (
                      <span className="text-xs font-bold uppercase text-primary">
                        ★ Captain
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
        )}
      </section>

      <section className="mt-8 border-2 border-primary bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Captain
        </p>

        <h2 className="mt-1 font-mono text-xl font-bold uppercase">
          Choose your captain
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          Your captain receives the captain multiplier for this day.
        </p>

        {selected.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Select players first.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {selected.map(player => (
              <label
                key={player.id}
                className={`flex items-center gap-3 border p-4 ${
                  captain ===
                  player.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background'
                } ${
                  selectedDayLocked
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name={`captain-${selectedDay.id}`}
                  value={player.id}
                  checked={
                    captain ===
                    player.id
                  }
                  disabled={
                    selectedDayLocked
                  }
                  onChange={() =>
                    setCaptain(
                      player.id
                    )
                  }
                />

                <div>
                  <p className="font-mono font-bold uppercase">
                    {player.nickname}
                  </p>

                  {captain ===
                    player.id && (
                    <p className="mt-1 text-xs font-bold uppercase text-primary">
                      ★ Captain
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {!selectedDayLocked && (
          <button
            type="button"
            onClick={saveDay}
            disabled={
              saving ||
              selected.length !==
                4 ||
              !captain
            }
            className="mt-6 w-full bg-primary px-6 py-4 font-bold uppercase text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : `Save ${selectedDay.name}`}
          </button>
        )}
      </section>

      {!selectedDayLocked && (
        <section className="mt-10">
          <div className="border-b border-border pb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Edit selection
            </p>

            <h2 className="mt-1 font-mono text-lg font-bold uppercase">
              Choose players
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Four players from four different teams.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedTeam(
                  null
                )
              }
              className={`border px-4 py-2 text-sm font-bold ${
                selectedTeam ===
                null
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card'
              }`}
            >
              All Teams
            </button>

            {teams
              .filter(team =>
                participatingTeamIDs.has(
                  team.id
                )
              )
              .map(team => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() =>
                    setSelectedTeam(
                      team.id
                    )
                  }
                  className={`border px-4 py-2 text-sm font-bold ${
                    selectedTeam ===
                    team.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  {team.name}
                </button>
              ))}
          </div>

          {loadingDay ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Loading players...
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visiblePlayers.map(player => {
                const isSelected =
                  selected.some(
                    item =>
                      item.id ===
                      player.id
                  )

                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() =>
                      togglePlayer(
                        player
                      )
                    }
                    className={`border p-5 text-left transition ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary'
                    }`}
                  >
                    <span className="text-xs text-muted-foreground">
                      {getTeamName(
                        player.team_id
                      )}
                    </span>

                    <strong className="mt-5 block font-mono uppercase">
                      {player.nickname}
                    </strong>

                    {isSelected && (
                      <span className="mt-3 block text-xs font-bold uppercase text-primary">
                        ✓ Selected
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {!loadingDay &&
            visiblePlayers.length ===
              0 && (
              <p className="mt-8 text-sm text-muted-foreground">
                No players are available for this tournament day.
              </p>
            )}
        </section>
      )}
    </>
  )}

  {points?.players &&
    points.players.length > 0 && (
      <section className="mt-14 border-t border-border pt-8">
        <h2 className="font-mono text-lg font-bold uppercase">
          Room scores
        </h2>

        <div className="mt-6 space-y-8">
          {selected.map(player => {
            const score =
              getPlayerScore(
                player.id
              )

            if (
              !score ||
              !score.rooms.length
            ) {
              return null
            }

            return (
              <div key={player.id}>
                <div className="flex items-center justify-between">
                  <h3 className="font-mono font-bold uppercase">
                    {player.nickname}
                  </h3>

                  <span className="text-sm text-muted-foreground">
                    {score.total_points}{' '}
                    points
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
                      {score.rooms.map(
                        room => (
                          <tr
                            key={
                              room.room_id
                            }
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-mono">
                              #
                              {
                                room.room_id
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                room.kills
                              }
                            </td>

                            <td className="px-4 py-3">
                              {
                                room.assists
                              }
                            </td>

                            <td className="px-4 py-3">
                              {room.first_blood
                                ? 'Yes'
                                : 'No'}
                            </td>

                            <td className="px-4 py-3">
                              {room.placement ||
                                '-'}
                            </td>

                            <td className="px-4 py-3 font-bold">
                              {
                                room.points
                              }
                            </td>
                          </tr>
                        )
                      )}
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
