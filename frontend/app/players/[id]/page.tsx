'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Crosshair,
  Flame,
  Medal,
  Shield,
  Swords,
  Target,
  Trophy,
  Users,
} from 'lucide-react'

import { api } from '@/lib/api'
import { errorMessage } from '@/lib/types'
import type {
  PlayerStatsResponse,
  PlayerDayStats,
  PlayerRoomStat,
  PlayerRanking,
} from '@/lib/types'

type Phase = 'league' | 'rush' | 'final' | 'unknown'

const PHASE_ORDER: Record<Phase, number> = {
  league: 0,
  rush: 1,
  final: 2,
  unknown: 99,
}

// Placement points by finishing position.
// 1st = 12, 2nd = 9, 3rd = 8, ... 10th = 1, 11th/12th = 0.
const PLACEMENT_POINTS = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0]

function getPlacementPoints(placement: number): number {
  if (placement < 1) return 0

  return PLACEMENT_POINTS[placement - 1] ?? 0
}

function parseDayName(
  name: string,
): { phase: Phase; week?: number; day?: number } {
  const league = name.match(/^week\s*(\d+)\s*day\s*(\d+)/i)

  if (league) {
    return {
      phase: 'league',
      week: Number(league[1]),
      day: Number(league[2]),
    }
  }

  const rush = name.match(/^rush\s*day\s*(\d+)/i)

  if (rush) {
    return {
      phase: 'rush',
      day: Number(rush[1]),
    }
  }

  const final = name.match(/^(grand\s*)?final\s*day\s*(\d+)/i)

  if (final) {
    return {
      phase: 'final',
      day: Number(final[2]),
    }
  }

  return {
    phase: 'unknown',
  }
}

function sortDaysByWeekDay(list: PlayerDayStats[]) {
  return [...list].sort((a, b) => {
    const pa = parseDayName(a.name)
    const pb = parseDayName(b.name)

    if (PHASE_ORDER[pa.phase] !== PHASE_ORDER[pb.phase]) {
      return PHASE_ORDER[pa.phase] - PHASE_ORDER[pb.phase]
    }

    const weekA = pa.week ?? 0
    const weekB = pb.week ?? 0

    if (weekA !== weekB) {
      return weekA - weekB
    }

    return (pa.day ?? 0) - (pb.day ?? 0)
  })
}

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>()

  const [data, setData] = useState<PlayerStatsResponse | null>(null)
  const [playerRankings, setPlayerRankings] = useState<PlayerRanking[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const playerId = Number(id)

    if (!playerId) {
      setError('Invalid player ID')
      return
    }

    Promise.all([
      api.playerStats(playerId),
      api.playerRankings(),
    ])
      .then(([playerResponse, rankingsResponse]) => {
        setData(playerResponse as PlayerStatsResponse)

        setPlayerRankings(
          Array.isArray(rankingsResponse)
            ? (rankingsResponse as PlayerRanking[])
            : [],
        )
      })
      .catch(error => {
        setError(errorMessage(error))
      })
  }, [id])

  const sortedDays = useMemo(() => {
    return data ? sortDaysByWeekDay(data.days) : []
  }, [data])

  /*
   * Calculate tournament-wide room statistics.
   */
  const playerMetrics = useMemo(() => {
    if (!data) {
      return {
        roomsPlayed: 0,
        killsPerRoom: 0,
        assistsPerRoom: 0,
        firstBloodsPerRoom: 0,
        placementPoints: 0,
        placementPointsPerRoom: 0,
        averagePlacement: 0,
        booyahs: 0,
      }
    }

    const rooms = data.days.flatMap(day => day.rooms)

    const roomsPlayed = rooms.length

    const placementPoints = rooms.reduce(
      (sum, room) => sum + getPlacementPoints(room.placement),
      0,
    )

    const averagePlacement =
      roomsPlayed > 0
        ? rooms.reduce((sum, room) => sum + room.placement, 0) /
          roomsPlayed
        : 0

    const booyahs = rooms.filter(room => room.placement === 1).length

    return {
      roomsPlayed,

      killsPerRoom:
        roomsPlayed > 0 ? data.total.kills / roomsPlayed : 0,

      assistsPerRoom:
        roomsPlayed > 0 ? data.total.assists / roomsPlayed : 0,

      firstBloodsPerRoom:
        roomsPlayed > 0
          ? data.total.first_blood / roomsPlayed
          : 0,

      placementPoints,

      placementPointsPerRoom:
        roomsPlayed > 0
          ? placementPoints / roomsPlayed
          : 0,

      averagePlacement,
      booyahs,
    }
  }, [data])

  /*
   * Find the current player's team and calculate
   * the team's total kills from the player rankings.
   *
   * Player kills / Team kills * 100
   */
  const killParticipation = useMemo(() => {
    if (!data || !playerRankings.length) {
      return null
    }

    const teamId = data.player.team_id

    const teamKills = playerRankings
      .filter(player => player.team_id === teamId)
      .reduce((sum, player) => sum + player.kills, 0)

    if (teamKills <= 0) {
      return null
    }

    return (data.total.kills / teamKills) * 100
  }, [data, playerRankings])

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <Link
          href="/players"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Players
        </Link>

        <p className="mt-8 text-red-400">
          {error}
        </p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
        <p className="text-muted-foreground">
          Loading player...
        </p>
      </main>
    )
  }

  const { player, total } = data

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-10">
      {/* Back */}
      <Link
        href="/players"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Players
      </Link>

      {/* Player Hero */}
      <section className="relative mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative">
          {/* Player identity */}
          <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
            {/* Player picture */}
            <div className="relative shrink-0">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted md:h-36 md:w-36">
                <img
                  alt={player.nickname}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Player ID badge */}
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                #{player.id}
              </span>
            </div>

            {/* Name + team */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Player Profile
              </p>

              <h1 className="mt-2 truncate text-3xl font-black tracking-tight md:text-5xl">
                {player.nickname}
              </h1>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background p-1.5">
                  {player.team_id ? (
                    <img
                      src={`/logos/${player.team_id}.png`}
                      alt="Team logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Squad
                  </p>

                  <p className="font-bold">
                    Team #{player.team_id}
                  </p>
                </div>
              </div>
            </div>

            {/* Total points */}
            <div className="shrink-0 rounded-xl border border-border bg-background/70 px-6 py-5 text-center md:min-w-36">
              <Trophy className="mx-auto h-5 w-5 text-primary" />

              <p className="mt-2 text-3xl font-black">
                {total.points}
              </p>

              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Points
              </p>
            </div>
          </div>

          {/* Main stats */}
          <div className="grid grid-cols-2 border-t border-border md:grid-cols-5">
            <HeroStat
              icon={<Crosshair className="h-4 w-4" />}
              label="Total Kills"
              value={total.kills}
            />

            <HeroStat
              icon={<Swords className="h-4 w-4" />}
              label="Kills / Room"
              value={formatDecimal(playerMetrics.killsPerRoom)}
            />

            <HeroStat
              icon={<Medal className="h-4 w-4" />}
              label="Placement Pts / Room"
              value={formatDecimal(
                playerMetrics.placementPointsPerRoom,
              )}
            />

            <HeroStat
              icon={<Users className="h-4 w-4" />}
              label="Rooms Played"
              value={playerMetrics.roomsPlayed}
            />

            <HeroStat
              icon={<Target className="h-4 w-4" />}
              label="Kill Participation"
              value={
                killParticipation !== null
                  ? `${formatDecimal(killParticipation)}%`
                  : '—'
              }
            />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 border-t border-border md:grid-cols-5">
            <MiniStat
              label="Assists"
              value={total.assists}
            />

            <MiniStat
              label="Assists / Room"
              value={formatDecimal(
                playerMetrics.assistsPerRoom,
              )}
            />

            <MiniStat
              label="First Bloods"
              value={total.first_blood}
            />

            <MiniStat
              label="Booyahs"
              value={playerMetrics.booyahs}
            />

            <MiniStat
              label="Avg Placement"
              value={
                playerMetrics.roomsPlayed > 0
                  ? formatDecimal(playerMetrics.averagePlacement)
                  : '—'
              }
            />
          </div>
        </div>
      </section>

      {/* Overall */}
      <section className="mt-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Performance
          </p>

          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
            Overall
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            icon={<Crosshair className="h-4 w-4" />}
            label="Kills"
            value={total.kills}
          />

          <StatCard
            icon={<Swords className="h-4 w-4" />}
            label="Assists"
            value={total.assists}
          />

          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="First Blood"
            value={total.first_blood}
          />

          <StatCard
            icon={<Trophy className="h-4 w-4" />}
            label="Points"
            value={total.points}
          />
        </div>
      </section>

      {/* Tournament Days */}
      <section className="mt-12 pb-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Match History
          </p>

          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
            Tournament Days
          </h2>
        </div>

        <div className="mt-6 space-y-10">
          {sortedDays.map(day => (
            <DaySection
              key={day.id}
              day={day}
            />
          ))}
        </div>

        {!sortedDays.length && (
          <div className="mt-6 rounded-xl border border-border p-8 text-center">
            <p className="text-muted-foreground">
              No statistics available yet.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
}) {
  return (
    <div className="border-r border-border p-5 last:border-r-0">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}

        <p className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </p>
      </div>

      <p className="mt-2 text-2xl font-black md:text-3xl">
        {value}
      </p>
    </div>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="border-r border-border p-4 last:border-r-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold">
        {value}
      </p>
    </div>
  )
}

function DaySection({
  day,
}: {
  day: PlayerDayStats
}) {
  const placementPoints = day.rooms.reduce(
    (sum, room) => sum + getPlacementPoints(room.placement),
    0,
  )

  return (
    <section className="border-t border-border pt-6">
      {/* Day header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-black">
            {day.name}
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            {day.rooms.length} rooms · {placementPoints} placement points
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card px-4 py-2 text-right">
          <p className="text-lg font-black">
            {day.total.points}
          </p>

          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Day Points
          </p>
        </div>
      </div>

      {/* Rooms */}
      <div className="mt-5 space-y-3">
        {day.rooms.map(room => (
          <RoomCard
            key={room.room_id}
            room={room}
          />
        ))}
      </div>

      {/* Day total */}
      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Day Total
          </h4>

          <span className="text-xs text-muted-foreground">
            {day.rooms.length} rooms
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Kills"
            value={day.total.kills}
            compact
          />

          <StatCard
            label="Assists"
            value={day.total.assists}
            compact
          />

          <StatCard
            label="First Blood"
            value={day.total.first_blood}
            compact
          />

          <StatCard
            label="Points"
            value={day.total.points}
            compact
          />
        </div>
      </div>
    </section>
  )
}

function RoomCard({
  room,
}: {
  room: PlayerRoomStat
}) {
  const placementPoints = getPlacementPoints(room.placement)

  return (
    <div className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex min-w-0 items-center gap-4">
        {/* Placement */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase text-muted-foreground">
              Place
            </p>

            <p className="text-lg font-black leading-none">
              {room.placement}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="font-bold">
            Room {room.room_number}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              {room.kills} kills
            </span>

            <span>
              {room.assists} assists
            </span>

            {room.first_blood && (
              <span className="font-semibold text-primary">
                First Blood
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Room points */}
      <div className="ml-4 shrink-0 text-right">
        <p className="text-lg font-black">
          {room.points}
        </p>

        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          points
        </p>

        <p className="mt-1 text-[10px] text-muted-foreground">
          {placementPoints} placement
        </p>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  compact = false,
}: {
  icon?: React.ReactNode
  label: string
  value: number | string
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}

        <p className="text-[10px] font-bold uppercase tracking-wider">
          {label}
        </p>
      </div>

      <p
        className={`mt-2 font-black ${
          compact
            ? 'text-xl'
            : 'text-2xl'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function formatDecimal(value: number): string {
  return value.toFixed(2)
}
