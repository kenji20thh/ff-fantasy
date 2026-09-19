package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"ff-fantasy/models"
)

type TeamHandler struct {
	DB *pgxpool.Pool
}

func (h *TeamHandler) GetTeams(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(
		context.Background(),
		"SELECT id, name, COALESCE(logo_url, '') FROM teams",
	)
	if err != nil {
		http.Error(w, "Failed to get teams", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	teams := []models.Team{}

	for rows.Next() {
		var team models.Team

		err := rows.Scan(
			&team.ID,
			&team.Name,
			&team.LogoURL,
		)
		if err != nil {
			http.Error(w, "Failed to read team", http.StatusInternalServerError)
			return
		}

		teams = append(teams, team)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading rows", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(teams)
}

func (h *TeamHandler) GetPlayers(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")

	rows, err := h.DB.Query(
		context.Background(),
		`SELECT id, team_id, nickname, COALESCE(picture_url, ''), price
		 FROM players
		 WHERE team_id = $1`,
		teamID,
	)
	if err != nil {
		http.Error(w, "Failed to get players", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	players := []models.Player{}

	for rows.Next() {
		var player models.Player

		err := rows.Scan(
			&player.ID,
			&player.TeamID,
			&player.Nickname,
			&player.PictureURL,
			&player.Price,
		)
		if err != nil {
			http.Error(w, "Failed to read player", http.StatusInternalServerError)
			return
		}

		players = append(players, player)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading rows", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(players)
}

func (h *TeamHandler) GetRoomStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	roomID := r.PathValue("id")

	rows, err := h.DB.Query(
		context.Background(),
		`SELECT
			p.id,
			p.team_id,
			p.nickname,
			COALESCE(p.picture_url, ''),
			COALESCE(prs.kills, 0),
			COALESCE(prs.assists, 0),
			COALESCE(prs.first_blood, false),
			COALESCE(prs.placement, 0)
		FROM rooms r
		JOIN tournament_day_teams tdt
			ON tdt.tournament_day_id = r.tournament_day_id
		JOIN players p
			ON p.team_id = tdt.team_id
		LEFT JOIN player_room_stats prs
			ON prs.room_id = r.id
			AND prs.player_id = p.id
		WHERE r.id = $1
		ORDER BY p.team_id, p.id`,
		roomID,
	)
	if err != nil {
		http.Error(w, "Failed to get statistics", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type PlayerRoomStats struct {
		PlayerID   int           `json:"player_id"`
		Player     models.Player `json:"player"`
		Kills      int           `json:"kills"`
		Assists    int           `json:"assists"`
		FirstBlood bool          `json:"first_blood"`
		Placement  int           `json:"placement"`
	}

	stats := []PlayerRoomStats{}

	for rows.Next() {
		var stat PlayerRoomStats

		err := rows.Scan(
			&stat.Player.ID,
			&stat.Player.TeamID,
			&stat.Player.Nickname,
			&stat.Player.PictureURL,
			&stat.Kills,
			&stat.Assists,
			&stat.FirstBlood,
			&stat.Placement,
		)
		if err != nil {
			http.Error(w, "Failed to read statistics", http.StatusInternalServerError)
			return
		}

		stat.PlayerID = stat.Player.ID

		stats = append(stats, stat)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading statistics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *TeamHandler) GetTeamStats(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")

	ctx := context.Background()

	playerRows, err := h.DB.Query(
		ctx,
		`SELECT
		p.id,
		p.nickname,
		COALESCE(p.picture_url, ''),
		COALESCE(SUM(prs.kills), 0)::int AS total_kills
	 FROM players p
	 LEFT JOIN player_room_stats prs
		ON prs.player_id = p.id
	 WHERE p.team_id = $1
	 GROUP BY p.id, p.nickname, p.picture_url
	 ORDER BY total_kills DESC, p.nickname ASC`,
		teamID,
	)

	if err != nil {
		http.Error(w, "Failed to get player kills", http.StatusInternalServerError)
		return
	}
	defer playerRows.Close()

	type PlayerKillsSummary struct {
		ID         int    `json:"id"`
		Nickname   string `json:"nickname"`
		PictureURL string `json:"picture_url"`
		TotalKills int    `json:"total_kills"`
	}

	players := []PlayerKillsSummary{}

	for playerRows.Next() {
		var p PlayerKillsSummary

		if err := playerRows.Scan(
			&p.ID,
			&p.Nickname,
			&p.PictureURL,
			&p.TotalKills,
		); err != nil {
			http.Error(w, "Failed to read player", http.StatusInternalServerError)
			return
		}

		players = append(players, p)
	}

	if err := playerRows.Err(); err != nil {
		http.Error(w, "Error reading players", http.StatusInternalServerError)
		return
	}

	mapRows, err := h.DB.Query(
		ctx,
		`WITH team_room_stats AS (
			SELECT
				r.map_type,
				prs.room_id,
				MIN(prs.placement) AS placement,
				SUM(prs.kills) AS kills
			FROM player_room_stats prs
			JOIN players p
				ON p.id = prs.player_id
			JOIN rooms r
				ON r.id = prs.room_id
			WHERE p.team_id = $1
				AND r.map_type IS NOT NULL
			GROUP BY r.map_type, prs.room_id
		),
		maps AS (
			SELECT unnest(ARRAY['Bermuda','Kalahari','NexTerra','Purgatory','Solara']) AS map_type
		)
		SELECT
			maps.map_type,
			COUNT(trs.room_id)::int AS rooms_played,
			COALESCE(ROUND(AVG(trs.kills)::numeric, 1), 0)::float8 AS avg_kills,
			COALESCE(ROUND(AVG(trs.placement)::numeric, 1), 0)::float8 AS avg_placement
		FROM maps
		LEFT JOIN team_room_stats trs
			ON trs.map_type = maps.map_type
		GROUP BY maps.map_type
		ORDER BY maps.map_type`,
		teamID,
	)

	if err != nil {
		http.Error(w, "Failed to get map statistics", http.StatusInternalServerError)
		return
	}
	defer mapRows.Close()

	type MapStats struct {
		MapType      string  `json:"map_type"`
		RoomsPlayed  int     `json:"rooms_played"`
		AvgKills     float64 `json:"avg_kills"`
		AvgPlacement float64 `json:"avg_placement"`
	}

	maps := []MapStats{}

	for mapRows.Next() {
		var m MapStats

		if err := mapRows.Scan(
			&m.MapType,
			&m.RoomsPlayed,
			&m.AvgKills,
			&m.AvgPlacement,
		); err != nil {
			http.Error(w, "Failed to read map stats", http.StatusInternalServerError)
			return
		}

		maps = append(maps, m)
	}

	if err := mapRows.Err(); err != nil {
		http.Error(w, "Error reading map stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"players": players,
		"maps":    maps,
	})
}
