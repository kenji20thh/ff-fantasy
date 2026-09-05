import type { ApiError } from "./types";
import { API_URL } from "./types";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";

  let data: unknown = null;

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    if (typeof data === "string" && data.trim()) {
      message = data.trim();
    } else if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      message = data.error;
    } else if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      message = data.message;
    }

    const error = new Error(message) as ApiError;
    error.status = response.status;
    throw error;
  }

  return data as T;
}

export const api = {
  me: () => apiFetch("/api/me"),

  login: (body: { identifier: string; password: string }) =>
    apiFetch("/api/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  register: (body: { username: string; email: string; password: string }) =>
    apiFetch("/api/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () =>
    apiFetch("/api/logout", {
      method: "POST",
    }),

  teams: () => apiFetch("/api/teams"),

  players: (id: number) => apiFetch(`/api/teams/${id}/players`),

  playerStats: (id: number) => apiFetch(`/api/players/${id}/stats`),

  leaderboard: (dayId?: number) =>
    apiFetch(dayId ? `/api/leaderboard?day_id=${dayId}` : "/api/leaderboard"),

  days: () => apiFetch("/api/tournament-days"),

  day: (id: number) => apiFetch(`/api/tournament-days/${id}`),

  rooms: (id: number) => apiFetch(`/api/tournament-days/${id}/rooms`),

  roomStats: (id: number) => apiFetch(`/api/rooms/${id}/stats`),

  fantasy: (id: number) => apiFetch(`/api/fantasy-teams/${id}`),

  fantasyPoints: (id: number) => apiFetch(`/api/fantasy-teams/${id}/points`),

  myFantasyTeam: () => apiFetch("/api/fantasy-teams/mine"),

  createFantasy: (user_id: number) =>
    apiFetch("/api/fantasy-teams", {
      method: "POST",
      body: JSON.stringify({ user_id }),
    }),

  selectPlayers: (
    id: number,
    body: {
      day_id: number;
      player_ids: number[];
    },
  ) =>
    apiFetch(`/api/fantasy-teams/${id}/players`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  captain: (id: number, day_id: number, player_id: number) =>
    apiFetch(`/api/fantasy-teams/${id}/captain`, {
      method: "POST",
      body: JSON.stringify({
        day_id,
        player_id,
      }),
    }),

  admin: (path: string, method: string, body?: unknown) =>
    apiFetch(`/api/admin${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    
  playerRankings: (dayId?: number, sort: "points" | "kills" = "points") => {
    const params = new URLSearchParams();

    if (dayId) {
      params.set("day_id", String(dayId));
    }

    params.set("sort", sort);

    return apiFetch(`/api/player-rankings?${params.toString()}`);
  },
};
