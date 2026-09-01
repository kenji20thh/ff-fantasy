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

func (h *AdminTournamentDayHandler) GetTournamentDays(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := context.Background()

	rows, err := h.DB.Query(
		ctx,
		`SELECT
			td.id,
			td.tournament_id,
			td.name,
			td.deadline_at
		FROM tournament_days td
		ORDER BY td.id`,
	)
	if err != nil {
		http.Error(w, "Failed to get tournament days", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type TournamentDay struct {
		ID           int       `json:"id"`
		TournamentID int       `json:"tournament_id"`
		Name         string    `json:"name"`
		DeadlineAt   time.Time `json:"deadline_at"`
		Teams        []int     `json:"teams"`
		RoomCount    int       `json:"room_count"`
	}

	var days []TournamentDay

	for rows.Next() {
		var day TournamentDay

		err := rows.Scan(
			&day.ID,
			&day.TournamentID,
			&day.Name,
			&day.DeadlineAt,
		)
		if err != nil {
			http.Error(w, "Failed to read tournament days", http.StatusInternalServerError)
			return
		}

		err = h.DB.QueryRow(
			ctx,
			`SELECT COALESCE(array_agg(team_id ORDER BY team_id), '{}')
			 FROM tournament_day_teams
			 WHERE tournament_day_id = $1`,
			day.ID,
		).Scan(&day.Teams)
		if err != nil {
			http.Error(w, "Failed to get tournament day teams", http.StatusInternalServerError)
			return
		}

		err = h.DB.QueryRow(
			ctx,
			`SELECT COUNT(*)
			 FROM rooms
			 WHERE tournament_day_id = $1`,
			day.ID,
		).Scan(&day.RoomCount)
		if err != nil {
			http.Error(w, "Failed to get room count", http.StatusInternalServerError)
			return
		}

		days = append(days, day)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to read tournament days", http.StatusInternalServerError)
		return
	}

	if days == nil {
		days = []TournamentDay{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(days)
}

func (h *AdminTournamentDayHandler) ManageTournamentDays(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetTournamentDays(w, r)
	case http.MethodPost:
		h.CreateTournamentDay(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *AdminTournamentDayHandler) GetTournamentDay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dayID := r.PathValue("id")
	ctx := context.Background()

	type TournamentDay struct {
		ID           int       `json:"id"`
		TournamentID int       `json:"tournament_id"`
		Name         string    `json:"name"`
		DeadlineAt   time.Time `json:"deadline_at"`
		Teams        []int     `json:"teams"`
		RoomCount    int       `json:"room_count"`
	}

	var day TournamentDay

	err := h.DB.QueryRow(
		ctx,
		`SELECT id, tournament_id, name, deadline_at
		 FROM tournament_days
		 WHERE id = $1`,
		dayID,
	).Scan(
		&day.ID,
		&day.TournamentID,
		&day.Name,
		&day.DeadlineAt,
	)

	if err != nil {
		http.Error(w, "Tournament day not found", http.StatusNotFound)
		return
	}

	err = h.DB.QueryRow(
		ctx,
		`SELECT COALESCE(array_agg(team_id ORDER BY team_id), '{}')
		 FROM tournament_day_teams
		 WHERE tournament_day_id = $1`,
		day.ID,
	).Scan(&day.Teams)

	if err != nil {
		http.Error(w, "Failed to get tournament day teams", http.StatusInternalServerError)
		return
	}

	err = h.DB.QueryRow(
		ctx,
		`SELECT COUNT(*)
		 FROM rooms
		 WHERE tournament_day_id = $1`,
		day.ID,
	).Scan(&day.RoomCount)

	if err != nil {
		http.Error(w, "Failed to get room count", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(day)
}
