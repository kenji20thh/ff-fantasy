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
		`SELECT id, team_id, nickname, COALESCE(picture_url, '')
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
