package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"ff-fantasy/models"
)

type AdminTeamHandler struct {
	DB *pgxpool.Pool
}

func (h *AdminTeamHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Name    string `json:"name"`
		LogoURL string `json:"logo_url"`
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
		`INSERT INTO teams (name, logo_url)
	 VALUES ($1, $2)
	 RETURNING id, name, logo_url`,
		request.Name,
		request.LogoURL,
	).Scan(
		&team.ID,
		&team.Name,
		&team.LogoURL,
	)

	if err != nil {
		http.Error(w, "Failed to create team", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(team)
}

func (h *AdminTeamHandler) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	teamID := r.PathValue("id")

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
		`UPDATE teams
		 SET name = $1
		 WHERE id = $2
		 RETURNING id, name`,
		request.Name,
		teamID,
	).Scan(&team.ID, &team.Name)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Team not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to update team", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(team)
}

func (h *AdminTeamHandler) DeleteTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	teamID := r.PathValue("id")

	result, err := h.DB.Exec(
		context.Background(),
		"DELETE FROM teams WHERE id = $1",
		teamID,
	)

	if err != nil {
		http.Error(w, "Failed to delete team", http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, "Team not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminTeamHandler) ManageTeam(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPut:
		h.UpdateTeam(w, r)
	case http.MethodDelete:
		h.DeleteTeam(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
