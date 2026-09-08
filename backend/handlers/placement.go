package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PlacementHandler struct {
	DB *pgxpool.Pool
}

type PlacementTeam struct {
	TeamID          int    `json:"team_id"`
	TeamName        string `json:"team_name"`
	PlacementPoints int    `json:"placement_points"`
	Kills           int    `json:"kills"`
	Points          int    `json:"points"`
	RoomsPlayed     int    `json:"rooms_played"`
}

func (h *PlacementHandler) GetPlacement(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	scope := r.URL.Query().Get("scope")

	var (
		query string
		args  []any
	)

	switch scope {
	case "room":
		roomID, err := strconv.Atoi(r.URL.Query().Get("room_id"))
		if err != nil {
			http.Error(w, "Invalid room_id", http.StatusBadRequest)
			return
		}

		query = placementRoomQuery
		args = []any{roomID}

	case "day":
		dayID, err := strconv.Atoi(r.URL.Query().Get("day_id"))
		if err != nil {
			http.Error(w, "Invalid day_id", http.StatusBadRequest)
			return
		}

		query = placementDayQuery
		args = []any{dayID}

	case "overall":
		query = placementOverallQuery

	default:
		http.Error(w, "Invalid scope", http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(context.Background(), query, args...)
	if err != nil {
		http.Error(w, "Failed to calculate placement", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	teams := []PlacementTeam{}

	for rows.Next() {
		var team PlacementTeam

		err := rows.Scan(
			&team.TeamID,
			&team.TeamName,
			&team.PlacementPoints,
			&team.Kills,
			&team.Points,
			&team.RoomsPlayed,
		)
		if err != nil {
			http.Error(w, "Failed to read placement", http.StatusInternalServerError)
			return
		}

		teams = append(teams, team)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading placement", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

const placementRoomQuery = `
WITH team_stats AS (
	SELECT
		t.id AS team_id,
		t.name AS team_name,
		prs.room_id,

		MAX(
			CASE prs.placement
				WHEN 1 THEN 12
				WHEN 2 THEN 9
				WHEN 3 THEN 8
				WHEN 4 THEN 7
				WHEN 5 THEN 6
				WHEN 6 THEN 5
				WHEN 7 THEN 4
				WHEN 8 THEN 3
				WHEN 9 THEN 2
				WHEN 10 THEN 1
				ELSE 0
			END
		) AS placement_points,

		SUM(prs.kills) AS kills

	FROM player_room_stats prs
	JOIN players p
		ON p.id = prs.player_id
	JOIN teams t
		ON t.id = p.team_id

	WHERE prs.room_id = $1

	GROUP BY t.id, t.name, prs.room_id
)

SELECT
	team_id,
	team_name,
	placement_points,
	kills,
	placement_points + kills AS points,
	1 AS rooms_played
FROM team_stats
ORDER BY points DESC, kills DESC, team_name;
`

const placementDayQuery = `
WITH team_room_stats AS (
	SELECT
		t.id AS team_id,
		t.name AS team_name,
		prs.room_id,

		MAX(
			CASE prs.placement
				WHEN 1 THEN 12
				WHEN 2 THEN 9
				WHEN 3 THEN 8
				WHEN 4 THEN 7
				WHEN 5 THEN 6
				WHEN 6 THEN 5
				WHEN 7 THEN 4
				WHEN 8 THEN 3
				WHEN 9 THEN 2
				WHEN 10 THEN 1
				ELSE 0
			END
		) AS placement_points,

		SUM(prs.kills) AS kills

	FROM player_room_stats prs
	JOIN players p
		ON p.id = prs.player_id
	JOIN teams t
		ON t.id = p.team_id
	JOIN rooms r
		ON r.id = prs.room_id

	WHERE r.tournament_day_id = $1

	GROUP BY t.id, t.name, prs.room_id
)

SELECT
	team_id,
	team_name,
	SUM(placement_points)::int AS placement_points,
	SUM(kills)::int AS kills,
	SUM(placement_points + kills)::int AS points,
	COUNT(*)::int AS rooms_played
FROM team_room_stats
GROUP BY team_id, team_name
ORDER BY points DESC, kills DESC, team_name;
`

const placementOverallQuery = `
WITH team_room_stats AS (
	SELECT
		t.id AS team_id,
		t.name AS team_name,
		prs.room_id,

		MAX(
			CASE prs.placement
				WHEN 1 THEN 12
				WHEN 2 THEN 9
				WHEN 3 THEN 8
				WHEN 4 THEN 7
				WHEN 5 THEN 6
				WHEN 6 THEN 5
				WHEN 7 THEN 4
				WHEN 8 THEN 3
				WHEN 9 THEN 2
				WHEN 10 THEN 1
				ELSE 0
			END
		) AS placement_points,

		SUM(prs.kills) AS kills

	FROM player_room_stats prs
	JOIN players p
		ON p.id = prs.player_id
	JOIN teams t
		ON t.id = p.team_id

	GROUP BY t.id, t.name, prs.room_id
)

SELECT
	team_id,
	team_name,
	SUM(placement_points)::int AS placement_points,
	SUM(kills)::int AS kills,
	SUM(placement_points + kills)::int AS points,
	COUNT(*)::int AS rooms_played
FROM team_room_stats
GROUP BY team_id, team_name
ORDER BY points DESC, kills DESC, team_name;
`

const placementWeekQuery = `
WITH team_room_stats AS (
	SELECT
		t.id AS team_id,
		t.name AS team_name,
		prs.room_id,

		MAX(
			CASE prs.placement
				WHEN 1 THEN 12
				WHEN 2 THEN 9
				WHEN 3 THEN 8
				WHEN 4 THEN 7
				WHEN 5 THEN 6
				WHEN 6 THEN 5
				WHEN 7 THEN 4
				WHEN 8 THEN 3
				WHEN 9 THEN 2
				WHEN 10 THEN 1
				ELSE 0
			END
		) AS placement_points,

		SUM(prs.kills) AS kills

	FROM player_room_stats prs
	JOIN players p
		ON p.id = prs.player_id
	JOIN teams t
		ON t.id = p.team_id
	JOIN rooms r
		ON r.id = prs.room_id
	JOIN tournament_days td
		ON td.id = r.tournament_day_id

	WHERE td.name LIKE $1 || ' %'

	GROUP BY
		t.id,
		t.name,
		prs.room_id
)

SELECT
	team_id,
	team_name,
	SUM(placement_points)::int AS placement_points,
	SUM(kills)::int AS kills,
	SUM(placement_points + kills)::int AS points,
	COUNT(*)::int AS rooms_played
FROM team_room_stats
GROUP BY team_id, team_name
ORDER BY points DESC, kills DESC, team_name;
`
