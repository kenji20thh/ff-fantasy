package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminTournamentDayHandler struct {
	DB *pgxpool.Pool
}

type CreateTournamentDayRequest struct {
	TournamentID int       `json:"tournament_id"`
	Name         string    `json:"name"`
	Teams        []int     `json:"teams"`
	RoomCount    int       `json:"room_count"`
	DeadlineAt   time.Time `json:"deadline_at"`
}

func (h *AdminTournamentDayHandler) CreateTournamentDay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request CreateTournamentDayRequest

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.TournamentID <= 0 {
		http.Error(w, "Tournament ID is required", http.StatusBadRequest)
		return
	}

	if request.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	if len(request.Teams) == 0 {
		http.Error(w, "At least one team is required", http.StatusBadRequest)
		return
	}

	if request.RoomCount <= 0 {
		http.Error(w, "Room count must be greater than 0", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var dayID int

	err = tx.QueryRow(
		ctx,
		`INSERT INTO tournament_days
			(tournament_id, name, deadline_at)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		request.TournamentID,
		request.Name,
		request.DeadlineAt,
	).Scan(&dayID)

	if err != nil {
		http.Error(w, "Failed to create tournament day", http.StatusInternalServerError)
		return
	}

	for _, teamID := range request.Teams {
		_, err = tx.Exec(
			ctx,
			`INSERT INTO tournament_day_teams
				(tournament_day_id, team_id)
			 VALUES ($1, $2)`,
			dayID,
			teamID,
		)

		if err != nil {
			http.Error(w, "Failed to add team to tournament day", http.StatusInternalServerError)
			return
		}
	}

	for roomNumber := 1; roomNumber <= request.RoomCount; roomNumber++ {
		_, err = tx.Exec(
			ctx,
			`INSERT INTO rooms
				(tournament_day_id, room_number)
			 VALUES ($1, $2)`,
			dayID,
			roomNumber,
		)

		if err != nil {
			http.Error(w, "Failed to create rooms", http.StatusInternalServerError)
			return
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		http.Error(w, "Failed to save tournament day", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":            dayID,
		"tournament_id": request.TournamentID,
		"name":          request.Name,
		"teams":         request.Teams,
		"room_count":    request.RoomCount,
		"deadline_at":   request.DeadlineAt,
	})
}
