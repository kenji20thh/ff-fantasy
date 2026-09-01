package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"ff-fantasy/models"
	"ff-fantasy/scoring"
)

type FantasyTeamHandler struct {
	DB       *pgxpool.Pool
	Sessions *SessionStore
}

func (h *FantasyTeamHandler) CreateFantasyTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, exists := h.Sessions.GetUserID(cookie.Value)
	if !exists {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var fantasyTeam models.FantasyTeam

	err = h.DB.QueryRow(
		context.Background(),
		"INSERT INTO fantasy_teams (user_id) VALUES ($1) RETURNING id, user_id",
		userID,
	).Scan(&fantasyTeam.ID, &fantasyTeam.UserID)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			http.Error(w, "You already have a fantasy team", http.StatusConflict)
			return
		}

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

	fantasyTeamID := r.PathValue("id")

	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, exists := h.Sessions.GetUserID(cookie.Value)
	if !exists {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var request struct {
		PlayerIDs []int `json:"player_ids"`
	}

	err = json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if len(request.PlayerIDs) != 4 {
		http.Error(w, "You must select exactly 4 players", http.StatusBadRequest)
		return
	}

	seen := make(map[int]bool)

	for _, playerID := range request.PlayerIDs {
		if seen[playerID] {
			http.Error(w, "Players must be 4 different players", http.StatusBadRequest)
			return
		}

		seen[playerID] = true
	}

	var teamOwnerID int

	err = h.DB.QueryRow(
		context.Background(),
		"SELECT user_id FROM fantasy_teams WHERE id = $1",
		fantasyTeamID,
	).Scan(&teamOwnerID)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Fantasy team not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to check fantasy team", http.StatusInternalServerError)
		return
	}

	if teamOwnerID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
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
		http.Error(w, "One or more players do not exist", http.StatusBadRequest)
		return
	}

	if len(teamIDs) != 4 {
		http.Error(w, "Players must come from 4 different teams", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Begin(context.Background())
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	_, err = tx.Exec(
		context.Background(),
		"DELETE FROM fantasy_team_players WHERE fantasy_team_id = $1",
		fantasyTeamID,
	)

	if err != nil {
		http.Error(w, "Failed to remove old players", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(
		context.Background(),
		"UPDATE fantasy_teams SET captain_player_id = NULL WHERE id = $1",
		fantasyTeamID,
	)
	if err != nil {
		http.Error(w, "Failed to reset captain", http.StatusInternalServerError)
		return
	}

	for _, playerID := range request.PlayerIDs {
		_, err = tx.Exec(
			context.Background(),
			"INSERT INTO fantasy_team_players (fantasy_team_id, player_id) VALUES ($1, $2)",
			fantasyTeamID,
			playerID,
		)
		if err != nil {
			http.Error(w, "Failed to save player selection", http.StatusInternalServerError)
			return
		}
	}

	err = tx.Commit(context.Background())
	if err != nil {
		http.Error(w, "Failed to save player selection", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"fantasy_team_id": fantasyTeamID,
		"player_ids":      request.PlayerIDs,
	})
}

func (h *FantasyTeamHandler) GetFantasyTeam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, exists := h.Sessions.GetUserID(cookie.Value)
	if !exists {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	fantasyTeamID := r.PathValue("id")

	var fantasyTeam models.FantasyTeam
	var captainPlayerID *int

	err = h.DB.QueryRow(
		context.Background(),
		"SELECT id, user_id, captain_player_id FROM fantasy_teams WHERE id = $1",
		fantasyTeamID,
	).Scan(
		&fantasyTeam.ID,
		&fantasyTeam.UserID,
		&captainPlayerID,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Fantasy team not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to get fantasy team", http.StatusInternalServerError)
		return
	}

	if fantasyTeam.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var playerIDs []int

	rows, err := h.DB.Query(
		context.Background(),
		"SELECT player_id FROM fantasy_team_players WHERE fantasy_team_id = $1",
		fantasyTeamID,
	)
	if err != nil {
		http.Error(w, "Failed to get selected players", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var playerID int

		err := rows.Scan(&playerID)
		if err != nil {
			http.Error(w, "Failed to read player", http.StatusInternalServerError)
			return
		}

		playerIDs = append(playerIDs, playerID)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading players", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                fantasyTeam.ID,
		"user_id":           fantasyTeam.UserID,
		"player_ids":        playerIDs,
		"captain_player_id": captainPlayerID,
	})
}

func (h *FantasyTeamHandler) SetCaptain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fantasyTeamID := r.PathValue("id")

	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, exists := h.Sessions.GetUserID(cookie.Value)
	if !exists {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var request struct {
		PlayerID int `json:"player_id"`
	}

	err = json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	var teamOwnerID int

	err = h.DB.QueryRow(
		context.Background(),
		"SELECT user_id FROM fantasy_teams WHERE id = $1",
		fantasyTeamID,
	).Scan(&teamOwnerID)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Fantasy team not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to find fantasy team", http.StatusInternalServerError)
		return
	}

	if teamOwnerID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var playerExists bool

	err = h.DB.QueryRow(
		context.Background(),
		`SELECT EXISTS(
			SELECT 1
			FROM fantasy_team_players
			WHERE fantasy_team_id = $1
			AND player_id = $2
		)`,
		fantasyTeamID,
		request.PlayerID,
	).Scan(&playerExists)

	if err != nil {
		http.Error(w, "Failed to check player", http.StatusInternalServerError)
		return
	}

	if !playerExists {
		http.Error(w, "Player is not in your fantasy team", http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec(
		context.Background(),
		"UPDATE fantasy_teams SET captain_player_id = $1 WHERE id = $2",
		request.PlayerID,
		fantasyTeamID,
	)

	if err != nil {
		http.Error(w, "Failed to set captain", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"fantasy_team_id":   fantasyTeamID,
		"captain_player_id": request.PlayerID,
	})
}

func (h *FantasyTeamHandler) GetFantasyTeamPoints(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fantasyTeamID := r.PathValue("id")

	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, exists := h.Sessions.GetUserID(cookie.Value)
	if !exists {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var teamOwnerID int
	var captainPlayerID *int

	err = h.DB.QueryRow(
		context.Background(),
		`SELECT user_id, captain_player_id
		 FROM fantasy_teams
		 WHERE id = $1`,
		fantasyTeamID,
	).Scan(&teamOwnerID, &captainPlayerID)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Fantasy team not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to find fantasy team", http.StatusInternalServerError)
		return
	}

	if teamOwnerID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	type RoomScore struct {
		RoomID     int  `json:"room_id"`
		Kills      int  `json:"kills"`
		Assists    int  `json:"assists"`
		FirstBlood bool `json:"first_blood"`
		Placement  int  `json:"placement"`
		Points     int  `json:"points"`
	}

	type PlayerScore struct {
		PlayerID    int         `json:"player_id"`
		Captain     bool        `json:"captain"`
		Rooms       []RoomScore `json:"rooms"`
		TotalPoints int         `json:"total_points"`
	}

	rows, err := h.DB.Query(
		context.Background(),
		`SELECT
			ftp.player_id,
			prs.room_id,
			COALESCE(prs.kills, 0),
			COALESCE(prs.assists, 0),
			COALESCE(prs.first_blood, false),
			COALESCE(prs.placement, 0)
		FROM fantasy_team_players ftp
		LEFT JOIN player_room_stats prs
			ON prs.player_id = ftp.player_id
		WHERE ftp.fantasy_team_id = $1
		ORDER BY ftp.player_id, prs.room_id`,
		fantasyTeamID,
	)

	if err != nil {
		http.Error(w, "Failed to get player statistics", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	players := make(map[int]*PlayerScore)

	for rows.Next() {
		var (
			playerID   int
			roomID     *int
			kills      int
			assists    int
			firstBlood bool
			placement  int
		)

		err := rows.Scan(
			&playerID,
			&roomID,
			&kills,
			&assists,
			&firstBlood,
			&placement,
		)

		if err != nil {
			http.Error(w, "Failed to read player statistics", http.StatusInternalServerError)
			return
		}

		if _, exists := players[playerID]; !exists {
			players[playerID] = &PlayerScore{
				PlayerID: playerID,
				Captain:  captainPlayerID != nil && playerID == *captainPlayerID,
				Rooms:    []RoomScore{},
			}
		}

		// No stats yet for this player.
		if roomID == nil {
			continue
		}

		points := scoring.PlayerRoomPoints(
			kills,
			assists,
			firstBlood,
			placement,
		)

		players[playerID].Rooms = append(
			players[playerID].Rooms,
			RoomScore{
				RoomID:     *roomID,
				Kills:      kills,
				Assists:    assists,
				FirstBlood: firstBlood,
				Placement:  placement,
				Points:     points,
			},
		)

		players[playerID].TotalPoints += points
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading player statistics", http.StatusInternalServerError)
		return
	}

	playerScores := make([]PlayerScore, 0, len(players))
	totalPoints := 0

	for _, player := range players {
		if player.Captain {
			player.TotalPoints *= 2
		}

		totalPoints += player.TotalPoints
		playerScores = append(playerScores, *player)
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"fantasy_team_id": fantasyTeamID,
		"total_points":    totalPoints,
		"players":         playerScores,
	})
}
