package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"
)

type AdminStatsHandler struct {
	DB *pgx.Conn
}

type PlayerRoomStatsRequest struct {
	Kills      int  `json:"kills"`
	Assists    int  `json:"assists"`
	FirstBlood bool `json:"first_blood"`
	Placement  int  `json:"placement"`
}

func (h *AdminStatsHandler) ManageStats(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.CreateStats(w, r)
	case http.MethodPut:
		h.UpdateStats(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *AdminStatsHandler) CreateStats(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("room_id")
	playerID := r.PathValue("player_id")

	var request PlayerRoomStatsRequest

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.Kills < 0 || request.Assists < 0 || request.Placement < 1 {
		http.Error(w, "Invalid statistics", http.StatusBadRequest)
		return
	}

	var exists bool

	err = h.DB.QueryRow(
		context.Background(),
		`SELECT EXISTS(
			SELECT 1
			FROM player_room_stats
			WHERE room_id = $1 AND player_id = $2
		)`,
		roomID,
		playerID,
	).Scan(&exists)

	if err != nil {
		http.Error(w, "Failed to check statistics", http.StatusInternalServerError)
		return
	}

	if exists {
		http.Error(w, "Statistics already exist", http.StatusConflict)
		return
	}

	_, err = h.DB.Exec(
		context.Background(),
		`INSERT INTO player_room_stats
			(room_id, player_id, kills, assists, first_blood, placement)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		roomID,
		playerID,
		request.Kills,
		request.Assists,
		request.FirstBlood,
		request.Placement,
	)

	if err != nil {
		http.Error(w, "Failed to create statistics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"room_id":     roomID,
		"player_id":   playerID,
		"kills":       request.Kills,
		"assists":     request.Assists,
		"first_blood": request.FirstBlood,
		"placement":   request.Placement,
	})
}

func (h *AdminStatsHandler) UpdateStats(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("room_id")
	playerID := r.PathValue("player_id")

	var request PlayerRoomStatsRequest

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.Kills < 0 || request.Assists < 0 || request.Placement < 1 {
		http.Error(w, "Invalid statistics", http.StatusBadRequest)
		return
	}

	result, err := h.DB.Exec(
		context.Background(),
		`UPDATE player_room_stats
		 SET kills = $1,
		     assists = $2,
		     first_blood = $3,
		     placement = $4
		 WHERE room_id = $5
		   AND player_id = $6`,
		request.Kills,
		request.Assists,
		request.FirstBlood,
		request.Placement,
		roomID,
		playerID,
	)

	if err != nil {
		http.Error(w, "Failed to update statistics", http.StatusInternalServerError)
		return
	}

	if result.RowsAffected() == 0 {
		http.Error(w, "Statistics not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"room_id":     roomID,
		"player_id":   playerID,
		"kills":       request.Kills,
		"assists":     request.Assists,
		"first_blood": request.FirstBlood,
		"placement":   request.Placement,
	})
}

func (h *AdminStatsHandler) GetRoomStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	roomID := r.PathValue("room_id")

	rows, err := h.DB.Query(
		context.Background(),
		`SELECT player_id, kills, assists, first_blood, placement
		 FROM player_room_stats
		 WHERE room_id = $1
		 ORDER BY player_id`,
		roomID,
	)
	if err != nil {
		http.Error(w, "Failed to get statistics", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type PlayerRoomStats struct {
		PlayerID   int  `json:"player_id"`
		Kills      int  `json:"kills"`
		Assists    int  `json:"assists"`
		FirstBlood bool `json:"first_blood"`
		Placement  int  `json:"placement"`
	}

	stats := []PlayerRoomStats{}

	for rows.Next() {
		var stat PlayerRoomStats

		err := rows.Scan(
			&stat.PlayerID,
			&stat.Kills,
			&stat.Assists,
			&stat.FirstBlood,
			&stat.Placement,
		)
		if err != nil {
			http.Error(w, "Failed to read statistics", http.StatusInternalServerError)
			return
		}

		stats = append(stats, stat)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading statistics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
