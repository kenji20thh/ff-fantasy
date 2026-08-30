package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"

	"ff-fantasy/models"
)

type FantasyTeamHandler struct {
	DB *pgx.Conn
}

func (h *FantasyTeamHandler) CreateFantasyTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		UserID int `json:"user_id"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	var fantasyTeam models.FantasyTeam

	err = h.DB.QueryRow(
		context.Background(),
		"INSERT INTO fantasy_teams (user_id) VALUES ($1) RETURNING id, user_id",
		request.UserID,
	).Scan(&fantasyTeam.ID, &fantasyTeam.UserID)

	if err != nil {
		http.Error(w, "Failed to create fantasy team", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(fantasyTeam)
}

func (h *FantasyTeamHandler) SelectPlayers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		PlayerIDs []int `json:"player_ids"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if len(request.PlayerIDs) != 4 {
		http.Error(w, "You must select exactly 4 players", http.StatusBadRequest)
		return
	}

	rows, err := h.DB.Query(
		context.Background(),
		"SELECT id, team_id FROM players WHERE id = ANY($1)",
		request.PlayerIDs,
	)
	if err != nil {
		http.Error(w, "Failed to get players", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	teamIDs := make(map[int]bool)
	playerCount := 0

	for rows.Next() {
		var playerID int
		var teamID int

		err := rows.Scan(&playerID, &teamID)
		if err != nil {
			http.Error(w, "Failed to read player", http.StatusInternalServerError)
			return
		}

		playerCount++
		teamIDs[teamID] = true
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading rows", http.StatusInternalServerError)
		return
	}

	if playerCount != 4 {
		http.Error(w, "Some players do not exist", http.StatusBadRequest)
		return
	}

	if len(teamIDs) != 4 {
		http.Error(w, "Players must be from different teams", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(request)
}
