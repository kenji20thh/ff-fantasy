package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"

	"ff-fantasy/models"
)

type AdminPlayerHandler struct {
	DB *pgx.Conn
}

func (h *AdminPlayerHandler) CreatePlayer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		TeamID   int    `json:"team_id"`
		Nickname string `json:"nickname"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.TeamID <= 0 || request.Nickname == "" {
		http.Error(w, "Team ID and nickname are required", http.StatusBadRequest)
		return
	}

	var player models.Player

	err = h.DB.QueryRow(
		context.Background(),
		`INSERT INTO players (team_id, nickname)
		 VALUES ($1, $2)
		 RETURNING id, team_id, nickname`,
		request.TeamID,
		request.Nickname,
	).Scan(
		&player.ID,
		&player.TeamID,
		&player.Nickname,
	)

	if err != nil {
		http.Error(w, "Failed to create player", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(player)
}
