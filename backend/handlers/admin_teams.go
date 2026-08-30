package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"

	"ff-fantasy/models"
)

type AdminTeamHandler struct {
	DB *pgx.Conn
}

func (h *AdminTeamHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Name string `json:"name"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.Name == "" {
		http.Error(w, "Team name is required", http.StatusBadRequest)
		return
	}

	var team models.Team

	err = h.DB.QueryRow(
		context.Background(),
		"INSERT INTO teams (name) VALUES ($1) RETURNING id, name",
		request.Name,
	).Scan(&team.ID, &team.Name)

	if err != nil {
		http.Error(w, "Failed to create team", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(team)
}
