export type Role = 'user' | 'admin'

export type User = {
  id: number
  username: string
  email: string
  role: Role
}

export type Team = {
  id: number
  name: string
  logo_url?: string
}

export type Player = {
  id: number
  team_id: number
  nickname: string
  picture_url?: string
}

export type TournamentDay = {
  id: number
  tournament_id: number
  name: string
  deadline_at: string
  teams?: Team[] | number[]
  room_count?: number
}

export type Room = {
  id: number
  name?: string
  tournament_day_id?: number
  [key: string]: unknown
}

export type RoomStats = {
  player_id: number
  player?: Player
  kills: number
  assists: number
  first_blood: boolean
  placement: number
  points?: number
}

export type LeaderboardEntry = {
  rank?: number
  username?: string
  points?: number
  user_id?: number
  fantasy_team_id?: number
  [key: string]: unknown
}

export type FantasyTeam = {
  id: number
  user_id?: number
  players?: Player[]
  captain_id?: number
  [key: string]: unknown
}

export type ApiError = Error & {
  status?: number
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://ff-fantasy.onrender.com'

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]

  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>

    for (const key of [
      'data',
      'teams',
      'players',
      'rooms',
      'stats',
      'entries',
      'leaderboard',
      'days',
    ]) {
      if (Array.isArray(v[key])) {
        return v[key] as T[]
      }
    }
  }

  return []
}

export function asObject<T>(value: unknown): T {
  if (value && typeof value === 'object') {
    return value as T
  }

  return value as T
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function dateLabel(value?: string) {
  if (!value) return 'TBA'

  const date = new Date(value)

  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

export type PlayerRoomStat = {
  room_id: number
  room_number: number
  kills: number
  assists: number
  first_blood: boolean
  placement: number
  points: number
}

export type PlayerDayTotal = {
  kills: number
  assists: number
  first_blood: number
  points: number
}

export type PlayerDayStats = {
  id: number
  name: string
  rooms: PlayerRoomStat[]
  total: PlayerDayTotal
}

export type PlayerStatsResponse = {
  player: Player
  days: PlayerDayStats[]
  total: PlayerDayTotal
}