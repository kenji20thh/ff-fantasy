export type User = { id: number; username: string; email: string }
export type Team = { id: number; name: string }
export type Player = { id: number; team_id: number; nickname: string }
export type FantasyTeam = { id: number; user_id: number; player_ids: number[]; captain_player_id: number | null }
export type LeaderboardEntry = { rank: number; username: string; fantasy_team_id: number; points: number }
export type TournamentDay = {
  id: number; tournament_id: number; name: string; deadline_at: string; teams: number[]; room_count: number
}
export type Room = { id: number; room_number: number }
export type RoomStat = { player_id: number; kills: number; assists: number; first_blood: boolean; placement: number }
export type PlayerRoomScore = {
  player_id: number; captain: boolean; rooms: Array<RoomStat & { room_id: number; points: number }>; total_points: number
}
export type FantasyPoints = { fantasy_team_id: number; total_points: number; players: PlayerRoomScore[] }
