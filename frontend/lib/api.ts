import type { ApiError } from './types'
import { API_URL } from './types'

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(
      data?.error ||
        data?.message ||
        `Request failed (${response.status})`
    ) as ApiError

    error.status = response.status
    throw error
  }

  return data as T
}

export const api = {
  me: () => apiFetch('/api/me'),

  login: (body: {
    identifier: string
    password: string
  }) =>
    apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  register: (body: {
    username: string
    email: string
    password: string
  }) =>
    apiFetch('/api/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    apiFetch('/api/logout', {
      method: 'POST',
    }),

  teams: () =>
    apiFetch('/api/teams'),

  players: (id: number) =>
    apiFetch(`/api/teams/${id}/players`),

  playerStats: (id: number) =>
    apiFetch(`/api/players/${id}/stats`),

  leaderboard: (dayId?: number) =>
    apiFetch(
      dayId
        ? `/api/leaderboard?day_id=${dayId}`
        : '/api/leaderboard'
    ),

  days: () =>
    apiFetch('/api/tournament-days'),

  day: (id: number) =>
    apiFetch(`/api/tournament-days/${id}`),

  rooms: (id: number) =>
    apiFetch(`/api/tournament-days/${id}/rooms`),

  roomStats: (id: number) =>
    apiFetch(`/api/rooms/${id}/stats`),

  fantasy: (id: number) =>
    apiFetch(`/api/fantasy-teams/${id}`),

  fantasyPoints: (id: number) =>
    apiFetch(`/api/fantasy-teams/${id}/points`),

  myFantasyTeam: () =>
    apiFetch('/api/fantasy-teams/mine'),

  createFantasy: (user_id: number) =>
    apiFetch('/api/fantasy-teams', {
      method: 'POST',
      body: JSON.stringify({ user_id }),
    }),

  selectPlayers: (id: number, players: unknown) =>
    apiFetch(`/api/fantasy-teams/${id}/players`, {
      method: 'POST',
      body: JSON.stringify(players),
    }),

  captain: (id: number, player_id: number) =>
    apiFetch(`/api/fantasy-teams/${id}/captain`, {
      method: 'POST',
      body: JSON.stringify({ player_id }),
    }),

  admin: (
    path: string,
    method: string,
    body?: unknown
  ) =>
    apiFetch(`/api/admin${path}`, {
      method,
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
    }),
}