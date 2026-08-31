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

func (h *AdminPlayerHandler) UpdatePlayer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	playerID := r.PathValue("id")

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
		`UPDATE players
		 SET team_id = $1, nickname = $2
		 WHERE id = $3
		 RETURNING id, team_id, nickname`,
		request.TeamID,
		request.Nickname,
		playerID,
	).Scan(
		&player.ID,
		&player.TeamID,
		&player.Nickname,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Player not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to update player", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(player)
}

func (h *AdminPlayerHandler) DeletePlayer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	playerID := r.PathValue("id")

	result, err := h.DB.Exec(
		context.Background(),
		"DELETE FROM players WHERE id = $1",
		playerID,
	)

	if err != nil {
		http.Error(w, "Failed to delete player", http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, "Player not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminPlayerHandler) ManagePlayer(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPut:
		h.UpdatePlayer(w, r)
	case http.MethodDelete:
		h.DeletePlayer(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
