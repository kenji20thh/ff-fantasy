export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export type User = { id: number; username: string; email: string; role?: string; is_admin?: boolean }
export type Player = { id: number; name: string; nickname?: string; team_id: number; team_name?: string }
export type Team = { id: number; name: string; logo_url?: string; players?: Player[] }
export type FantasyTeam = { id: number; user_id: number; player_ids: number[]; captain_player_id: number | null }
export type LeaderboardEntry = { rank?: number; username?: string; user_name?: string; points?: number; total_points?: number }
export type TournamentDay = { id: number; tournament_id: number; name: string; deadline_at: string; teams: number[]; room_count: number }
export type Room = { id: number; room_number: number }
export type RoomStat = { player_id: number; kills: number; assists: number; first_blood: boolean; placement: number }

export class ApiError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status } }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) } })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null ? String((body as Record<string, unknown>).message ?? (body as Record<string, unknown>).error ?? text) : String(body || response.statusText)
    throw new ApiError(message || 'Request failed', response.status)
  }
  return body as T
}
const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
export const api = {
  me: () => request<User>('/api/me'),
  login: (body: { email: string; password: string }) => request<User>('/api/login', json(body)),
  register: (body: { username: string; email: string; password: string }) => request<User>('/api/register', json(body)),
  logout: () => request<void>('/api/logout', { method: 'POST' }),
  teams: () => request<Team[]>('/api/teams'),
  teamPlayers: (id: number) => request<Player[]>(`/api/teams/${id}/players`),
  leaderboard: () => request<LeaderboardEntry[]>('/api/leaderboard'),
  fantasyCreate: () => request<FantasyTeam>('/api/fantasy-teams', json({})),
  fantasy: (id: number) => request<FantasyTeam>(`/api/fantasy-teams/${id}`),
  fantasyPlayers: (id: number, player_ids: number[]) => request<FantasyTeam>(`/api/fantasy-teams/${id}/players`, json({ player_ids })),
  captain: (id: number, player_id: number) => request<FantasyTeam>(`/api/fantasy-teams/${id}/captain`, json({ player_id })),
  points: (id: number) => request<unknown>(`/api/fantasy-teams/${id}/points`),
  adminDays: () => request<TournamentDay[]>('/api/admin/tournament-days'),
  adminDay: (id: number) => request<TournamentDay>(`/api/admin/tournament-days/${id}`),
  rooms: (id: number) => request<Room[]>(`/api/admin/tournament-days/${id}/rooms`),
  createDay: (body: unknown) => request<TournamentDay>('/api/admin/tournament-days', json(body)),
  updateDay: (id: number, body: unknown) => request<TournamentDay>(`/api/admin/tournament-days/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDay: (id: number) => request<void>(`/api/admin/tournament-days/${id}`, { method: 'DELETE' }),
  roomStats: (id: number) => request<RoomStat[]>(`/api/rooms/${id}/stats`),
}
