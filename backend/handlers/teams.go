package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"

	"ff-fantasy/models"
)

type TeamHandler struct {
	DB *pgx.Conn
}

func (h *TeamHandler) GetTeams(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(
		context.Background(),
		"SELECT id, name FROM teams",
	)
	if err != nil {
		http.Error(w, "Failed to get teams", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	teams := []models.Team{}

	for rows.Next() {
		var team models.Team

		err := rows.Scan(&team.ID, &team.Name)
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
		"SELECT id, team_id, nickname FROM players WHERE team_id = $1",
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
