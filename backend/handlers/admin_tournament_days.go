package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminTournamentDayHandler struct {
	DB *pgxpool.Pool
}

type CreateTournamentDayRequest struct {
	TournamentID int        `json:"tournament_id"`
	Name         string     `json:"name"`
	Teams        []int      `json:"teams"`
	RoomCount    int        `json:"room_count"`
	DeadlineAt   *time.Time `json:"deadline_at"`
}

type TournamentDayResponse struct {
	ID           int        `json:"id"`
	TournamentID int        `json:"tournament_id"`
	Name         string     `json:"name"`
	DeadlineAt   *time.Time `json:"deadline_at"`
	Teams        []int      `json:"teams"`
	RoomCount    int        `json:"room_count"`
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

func (h *AdminTournamentDayHandler) ManageTournamentDay(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.GetTournamentDay(w, r)
	case http.MethodPut:
		h.UpdateTournamentDay(w, r)
	case http.MethodDelete:
		h.DeleteTournamentDay(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *AdminTournamentDayHandler) CreateTournamentDay(w http.ResponseWriter, r *http.Request) {
	var request CreateTournamentDayRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
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

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Failed to save tournament day", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	json.NewEncoder(w).Encode(TournamentDayResponse{
		ID:           dayID,
		TournamentID: request.TournamentID,
		Name:         request.Name,
		Teams:        request.Teams,
		RoomCount:    request.RoomCount,
		DeadlineAt:   request.DeadlineAt,
	})
}

func (h *AdminTournamentDayHandler) GetTournamentDays(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	rows, err := h.DB.Query(
		ctx,
		`SELECT id, tournament_id, name, deadline_at
		 FROM tournament_days
		 ORDER BY id`,
	)
	if err != nil {
		http.Error(w, "Failed to get tournament days", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	days := []TournamentDayResponse{}

	for rows.Next() {
		var day TournamentDayResponse

		if err := rows.Scan(
			&day.ID,
			&day.TournamentID,
			&day.Name,
			&day.DeadlineAt,
		); err != nil {
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(days)
}

func (h *AdminTournamentDayHandler) GetTournamentDay(w http.ResponseWriter, r *http.Request) {
	dayID := r.PathValue("id")
	ctx := context.Background()

	var day TournamentDayResponse

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
		if err == pgx.ErrNoRows {
			http.Error(w, "Tournament day not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to get tournament day", http.StatusInternalServerError)
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

func (h *AdminTournamentDayHandler) UpdateTournamentDay(w http.ResponseWriter, r *http.Request) {
	dayID := r.PathValue("id")

	var request CreateTournamentDayRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
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

	// Check that the tournament day exists.
	var exists bool

	err := h.DB.QueryRow(
		ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM tournament_days
			WHERE id = $1
		)`,
		dayID,
	).Scan(&exists)

	if err != nil {
		http.Error(w, "Failed to find tournament day", http.StatusInternalServerError)
		return
	}

	if !exists {
		http.Error(w, "Tournament day not found", http.StatusNotFound)
		return
	}

	// Update the tournament day.
	_, err = h.DB.Exec(
		ctx,
		`UPDATE tournament_days
		 SET tournament_id = $1,
		     name = $2,
		     deadline_at = $3
		 WHERE id = $4`,
		request.TournamentID,
		request.Name,
		request.DeadlineAt,
		dayID,
	)

	if err != nil {
		http.Error(w, "Failed to update tournament day", http.StatusInternalServerError)
		return
	}

	// Replace participating teams.
	_, err = h.DB.Exec(
		ctx,
		`DELETE FROM tournament_day_teams
		 WHERE tournament_day_id = $1`,
		dayID,
	)

	if err != nil {
		http.Error(w, "Failed to update tournament day teams", http.StatusInternalServerError)
		return
	}

	for _, teamID := range request.Teams {
		_, err = h.DB.Exec(
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

	// Get current room count.
	var currentRoomCount int

	err = h.DB.QueryRow(
		ctx,
		`SELECT COUNT(*)
		 FROM rooms
		 WHERE tournament_day_id = $1`,
		dayID,
	).Scan(&currentRoomCount)

	if err != nil {
		http.Error(w, "Failed to get current room count", http.StatusInternalServerError)
		return
	}

	// Add rooms if needed.
	if request.RoomCount > currentRoomCount {
		for roomNumber := currentRoomCount + 1; roomNumber <= request.RoomCount; roomNumber++ {
			_, err = h.DB.Exec(
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
	}

	// Remove rooms if needed.
	if request.RoomCount < currentRoomCount {
		for roomNumber := currentRoomCount; roomNumber > request.RoomCount; roomNumber++ {

			var hasStats bool

			err = h.DB.QueryRow(
				ctx,
				`SELECT EXISTS(
					SELECT 1
					FROM player_room_stats prs
					JOIN rooms r ON r.id = prs.room_id
					WHERE r.tournament_day_id = $1
					  AND r.room_number = $2
				)`,
				dayID,
				roomNumber,
			).Scan(&hasStats)

			if err != nil {
				http.Error(w, "Failed to check room statistics", http.StatusInternalServerError)
				return
			}

			if hasStats {
				http.Error(
					w,
					"Cannot reduce room count because room "+strconv.Itoa(roomNumber)+" already has statistics",
					http.StatusConflict,
				)
				return
			}

			_, err = h.DB.Exec(
				ctx,
				`DELETE FROM rooms
				 WHERE tournament_day_id = $1
				   AND room_number = $2`,
				dayID,
				roomNumber,
			)

			if err != nil {
				http.Error(w, "Failed to delete room", http.StatusInternalServerError)
				return
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")

	id, _ := strconv.Atoi(dayID)

	json.NewEncoder(w).Encode(TournamentDayResponse{
		ID:           id,
		TournamentID: request.TournamentID,
		Name:         request.Name,
		Teams:        request.Teams,
		RoomCount:    request.RoomCount,
		DeadlineAt:   request.DeadlineAt,
	})
}

func (h *AdminTournamentDayHandler) DeleteTournamentDay(w http.ResponseWriter, r *http.Request) {
	dayID := r.PathValue("id")
	ctx := context.Background()

	var hasStats bool

	err := h.DB.QueryRow(
		ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM player_room_stats prs
			JOIN rooms r ON r.id = prs.room_id
			WHERE r.tournament_day_id = $1
		)`,
		dayID,
	).Scan(&hasStats)

	if err != nil {
		http.Error(w, "Failed to check tournament day statistics", http.StatusInternalServerError)
		return
	}

	if hasStats {
		http.Error(
			w,
			"Cannot delete tournament day because it has player statistics",
			http.StatusConflict,
		)
		return
	}

	result, err := h.DB.Exec(
		ctx,
		`DELETE FROM tournament_days
		 WHERE id = $1`,
		dayID,
	)

	if err != nil {
		http.Error(w, "Failed to delete tournament day", http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, "Tournament day not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminTournamentDayHandler) GetTournamentDayRooms(w http.ResponseWriter, r *http.Request) {
	dayID := r.PathValue("id")

	rows, err := h.DB.Query(
		context.Background(),
		`SELECT id, room_number
		 FROM rooms
		 WHERE tournament_day_id = $1
		 ORDER BY room_number`,
		dayID,
	)

	if err != nil {
		http.Error(w, "Failed to get rooms", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Room struct {
		ID         int `json:"id"`
		RoomNumber int `json:"room_number"`
	}

	rooms := []Room{}

	for rows.Next() {
		var room Room

		if err := rows.Scan(&room.ID, &room.RoomNumber); err != nil {
			http.Error(w, "Failed to read rooms", http.StatusInternalServerError)
			return
		}

		rooms = append(rooms, room)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to read rooms", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rooms)
}

func (h *AdminTournamentDayHandler) GetTournamentDayKills(w http.ResponseWriter, r *http.Request) {
	dayID := r.PathValue("id")

	rows, err := h.DB.Query(
		context.Background(),
		`SELECT
			p.id,
			p.nickname,
			p.picture_url,
			p.team_id,
			t.name,
			SUM(prs.kills) AS total_kills
		FROM player_room_stats prs
		JOIN rooms r
			ON r.id = prs.room_id
		JOIN players p
			ON p.id = prs.player_id
		JOIN teams t
			ON t.id = p.team_id
		WHERE r.tournament_day_id = $1
		GROUP BY p.id, p.nickname, p.picture_url, p.team_id, t.name
		ORDER BY total_kills DESC, p.nickname ASC`,
		dayID,
	)

	if err != nil {
		http.Error(w, "Failed to get kills", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type PlayerKills struct {
		PlayerID   int    `json:"player_id"`
		Nickname   string `json:"nickname"`
		PictureURL string `json:"picture_url"`
		TeamID     int    `json:"team_id"`
		TeamName   string `json:"team_name"`
		Kills      int    `json:"kills"`
	}

	kills := []PlayerKills{}

	for rows.Next() {
		var k PlayerKills

		if err := rows.Scan(
			&k.PlayerID, &k.Nickname, &k.PictureURL,
			&k.TeamID, &k.TeamName, &k.Kills,
		); err != nil {
			http.Error(w, "Failed to read kills", http.StatusInternalServerError)
			return
		}

		kills = append(kills, k)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to read kills", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(kills)
}
