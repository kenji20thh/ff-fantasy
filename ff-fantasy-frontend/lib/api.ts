import type { FantasyPoints, FantasyTeam, LeaderboardEntry, Player, Room, RoomStat, Team, TournamentDay, User } from "./types"

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ApiError" }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    cache: "no-store",
  })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) {
    const message = typeof body === "string" ? body : "Request failed"
    throw new ApiError(response.status, message)
  }
  return body as T
}
const post = (body?: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body ?? {}) })
const put = (body: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(body) })

export const api = {
  me: () => request<User>("/api/me"),
  login: (body: { email: string; password: string }) => request<User>("/api/login", post(body)),
  register: (body: { username: string; email: string; password: string }) => request<User>("/api/register", post(body)),
  logout: () => request<void>("/api/logout", { method: "POST" }),
  teams: () => request<Team[]>("/api/teams"),
  players: (teamId: number) => request<Player[]>(`/api/teams/${teamId}/players`),
  leaderboard: () => request<LeaderboardEntry[]>("/api/leaderboard"),
  createFantasyTeam: () => request<FantasyTeam>("/api/fantasy-teams", post()),
  fantasy: (id: number) => request<FantasyTeam>(`/api/fantasy-teams/${id}`),
  selectPlayers: (id: number, player_ids: number[]) => request<FantasyTeam>(`/api/fantasy-teams/${id}/players`, post({ player_ids })),
  setCaptain: (id: number, player_id: number) => request<{ fantasy_team_id: string; captain_player_id: number }>(`/api/fantasy-teams/${id}/captain`, post({ player_id })),
  fantasyPoints: (id: number) => request<FantasyPoints>(`/api/fantasy-teams/${id}/points`),
  tournamentDays: () => request<TournamentDay[]>("/api/tournament-days"),
  tournamentDay: (id: number) => request<TournamentDay>(`/api/tournament-days/${id}`),
  rooms: (dayId: number) => request<Room[]>(`/api/tournament-days/${dayId}/rooms`),
  roomStats: (roomId: number) => request<RoomStat[]>(`/api/rooms/${roomId}/stats`),
  adminCreateTeam: (name: string) => request<Team>("/api/admin/teams", post({ name })),
  adminUpdateTeam: (id: number, name: string) => request<Team>(`/api/admin/teams/${id}`, put({ name })),
  adminDeleteTeam: (id: number) => request<void>(`/api/admin/teams/${id}`, { method: "DELETE" }),
  adminCreatePlayer: (team_id: number, nickname: string) => request<Player>("/api/admin/players", post({ team_id, nickname })),
  adminUpdatePlayer: (id: number, team_id: number, nickname: string) => request<Player>(`/api/admin/players/${id}`, put({ team_id, nickname })),
  adminDeletePlayer: (id: number) => request<void>(`/api/admin/players/${id}`, { method: "DELETE" }),
  adminCreateDay: (body: { tournament_id: number; name: string; teams: number[]; room_count: number; deadline_at: string }) => request<TournamentDay>("/api/admin/tournament-days", post(body)),
  adminUpdateDay: (id: number, body: { tournament_id: number; name: string; teams: number[]; room_count: number; deadline_at: string }) => request<TournamentDay>(`/api/admin/tournament-days/${id}`, put(body)),
  adminDeleteDay: (id: number) => request<void>(`/api/admin/tournament-days/${id}`, { method: "DELETE" }),
  adminCreateStats: (roomId: number, playerId: number, body: Omit<RoomStat, "player_id">) => request<RoomStat>(`/api/admin/rooms/${roomId}/stats/${playerId}`, post(body)),
  adminUpdateStats: (roomId: number, playerId: number, body: Omit<RoomStat, "player_id">) => request<RoomStat>(`/api/admin/rooms/${roomId}/stats/${playerId}`, put(body)),
}
