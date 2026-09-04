package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"

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
		DayID     int   `json:"day_id"`
		PlayerIDs []int `json:"player_ids"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if len(request.PlayerIDs) != 4 {
		http.Error(w, "You must select exactly 4 players", http.StatusBadRequest)
		return
	}

	if request.DayID == 0 {
		http.Error(w, "Tournament day is required", http.StatusBadRequest)
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

	ctx := context.Background()

	var teamOwnerID int

	err = h.DB.QueryRow(
		ctx,
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

	// Check that this specific tournament day exists and its
	// deadline has not passed.
	var deadline *string

	err = h.DB.QueryRow(
		ctx,
		`SELECT deadline_at::text
		 FROM tournament_days
		 WHERE id = $1`,
		request.DayID,
	).Scan(&deadline)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Tournament day not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to get tournament day", http.StatusInternalServerError)
		return
	}

	if deadline != nil {
		var open bool

		err = h.DB.QueryRow(
			ctx,
			`SELECT deadline_at > now()
			 FROM tournament_days
			 WHERE id = $1`,
			request.DayID,
		).Scan(&open)

		if err != nil {
			http.Error(w, "Failed to check tournament day deadline", http.StatusInternalServerError)
			return
		}

		if !open {
			http.Error(w, "This tournament day is locked.", http.StatusLocked)
			return
		}
	}

	// Make sure all players exist and belong to 4 different teams.
	rows, err := h.DB.Query(
		ctx,
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

		if err := rows.Scan(&playerID, &teamID); err != nil {
			http.Error(w, "Failed to read player", http.StatusInternalServerError)
			return
		}

		playerCount++
		teamIDs[teamID] = true
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading players", http.StatusInternalServerError)
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

	tx, err := h.DB.Begin(ctx)
	if err != nil {
		http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// One selection per fantasy team per tournament day.
	var selectionID int

	err = tx.QueryRow(
		ctx,
		`INSERT INTO fantasy_team_day_selections
			(fantasy_team_id, tournament_day_id)
		 VALUES ($1, $2)
		 ON CONFLICT (fantasy_team_id, tournament_day_id)
		 DO UPDATE SET tournament_day_id = EXCLUDED.tournament_day_id
		 RETURNING id`,
		fantasyTeamID,
		request.DayID,
	).Scan(&selectionID)

	if err != nil {
		http.Error(w, "Failed to save tournament day selection", http.StatusInternalServerError)
		return
	}

	// If the user changes their selection before the deadline,
	// only THIS day's players are replaced.
	// Previous tournament days remain untouched.
	_, err = tx.Exec(
		ctx,
		`DELETE FROM fantasy_team_day_players
		 WHERE selection_id = $1`,
		selectionID,
	)

	if err != nil {
		http.Error(w, "Failed to remove old day players", http.StatusInternalServerError)
		return
	}

	for _, playerID := range request.PlayerIDs {
		_, err = tx.Exec(
			ctx,
			`INSERT INTO fantasy_team_day_players
				(selection_id, player_id)
			 VALUES ($1, $2)`,
			selectionID,
			playerID,
		)

		if err != nil {
			http.Error(w, "Failed to save player selection", http.StatusInternalServerError)
			return
		}
	}

	// Reset the captain for this day only.
	_, err = tx.Exec(
		ctx,
		`UPDATE fantasy_team_day_selections
		 SET captain_player_id = NULL
		 WHERE id = $1`,
		selectionID,
	)

	if err != nil {
		http.Error(w, "Failed to reset day captain", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Failed to save player selection", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"fantasy_team_id": fantasyTeamID,
		"day_id":          request.DayID,
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
	ctx := context.Background()

	var fantasyTeam models.FantasyTeam

	err = h.DB.QueryRow(
		ctx,
		`SELECT id, user_id
		 FROM fantasy_teams
		 WHERE id = $1`,
		fantasyTeamID,
	).Scan(
		&fantasyTeam.ID,
		&fantasyTeam.UserID,
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

	// Return all day selections so the frontend can display history.
	rows, err := h.DB.Query(
		ctx,
		`SELECT
			s.id,
			s.tournament_day_id,
			s.captain_player_id,
			td.name
		 FROM fantasy_team_day_selections s
		 JOIN tournament_days td
			ON td.id = s.tournament_day_id
		 WHERE s.fantasy_team_id = $1
		 ORDER BY s.tournament_day_id`,
		fantasyTeamID,
	)

	if err != nil {
		http.Error(w, "Failed to get day selections", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type DaySelection struct {
		ID              int    `json:"id"`
		DayID           int    `json:"day_id"`
		DayName         string `json:"day_name"`
		PlayerIDs       []int  `json:"player_ids"`
		CaptainPlayerID *int   `json:"captain_player_id"`
	}

	var selections []DaySelection

	for rows.Next() {
		var (
			selectionID     int
			dayID           int
			captainPlayerID *int
			dayName         string
		)

		if err := rows.Scan(
			&selectionID,
			&dayID,
			&captainPlayerID,
			&dayName,
		); err != nil {
			http.Error(w, "Failed to read day selection", http.StatusInternalServerError)
			return
		}

		playerRows, err := h.DB.Query(
			ctx,
			`SELECT player_id
			 FROM fantasy_team_day_players
			 WHERE selection_id = $1
			 ORDER BY player_id`,
			selectionID,
		)

		if err != nil {
			http.Error(w, "Failed to get day players", http.StatusInternalServerError)
			return
		}

		var playerIDs []int

		for playerRows.Next() {
			var playerID int

			if err := playerRows.Scan(&playerID); err != nil {
				playerRows.Close()
				http.Error(w, "Failed to read day player", http.StatusInternalServerError)
				return
			}

			playerIDs = append(playerIDs, playerID)
		}

		playerRows.Close()

		selections = append(selections, DaySelection{
			ID:              selectionID,
			DayID:           dayID,
			DayName:         dayName,
			PlayerIDs:       playerIDs,
			CaptainPlayerID: captainPlayerID,
		})
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading day selections", http.StatusInternalServerError)
		return
	}

	// Return the latest selection as player_ids/captain_player_id
	// for compatibility with the existing frontend.
	var currentPlayerIDs []int
	var currentCaptain *int
	var currentDayID *int

	if len(selections) > 0 {
		last := selections[len(selections)-1]
		currentPlayerIDs = last.PlayerIDs
		currentCaptain = last.CaptainPlayerID
		currentDayID = &last.DayID
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                fantasyTeam.ID,
		"user_id":           fantasyTeam.UserID,
		"day_id":            currentDayID,
		"player_ids":        currentPlayerIDs,
		"captain_player_id": currentCaptain,
		"days":              selections,
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
		DayID    int `json:"day_id"`
		PlayerID int `json:"player_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.DayID == 0 {
		http.Error(w, "Tournament day is required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	var teamOwnerID int

	err = h.DB.QueryRow(
		ctx,
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

	var open bool

	err = h.DB.QueryRow(
		ctx,
		`SELECT
			deadline_at IS NULL OR deadline_at > now()
		 FROM tournament_days
		 WHERE id = $1`,
		request.DayID,
	).Scan(&open)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Tournament day not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to check tournament day", http.StatusInternalServerError)
		return
	}

	if !open {
		http.Error(w, "This tournament day is locked.", http.StatusLocked)
		return
	}

	var selectionID int

	err = h.DB.QueryRow(
		ctx,
		`SELECT id
		 FROM fantasy_team_day_selections
		 WHERE fantasy_team_id = $1
		 AND tournament_day_id = $2`,
		fantasyTeamID,
		request.DayID,
	).Scan(&selectionID)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "You have not selected players for this tournament day", http.StatusBadRequest)
			return
		}

		http.Error(w, "Failed to find day selection", http.StatusInternalServerError)
		return
	}

	var playerExists bool

	err = h.DB.QueryRow(
		ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM fantasy_team_day_players
			WHERE selection_id = $1
			AND player_id = $2
		)`,
		selectionID,
		request.PlayerID,
	).Scan(&playerExists)

	if err != nil {
		http.Error(w, "Failed to check player", http.StatusInternalServerError)
		return
	}

	if !playerExists {
		http.Error(w, "Player is not in this day's fantasy team", http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec(
		ctx,
		`UPDATE fantasy_team_day_selections
		 SET captain_player_id = $1
		 WHERE id = $2`,
		request.PlayerID,
		selectionID,
	)

	if err != nil {
		http.Error(w, "Failed to set captain", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"fantasy_team_id":   fantasyTeamID,
		"day_id":            request.DayID,
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

	ctx := context.Background()

	var teamOwnerID int

	err = h.DB.QueryRow(
		ctx,
		`SELECT user_id
		 FROM fantasy_teams
		 WHERE id = $1`,
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

	type DayScore struct {
		DayID       int           `json:"day_id"`
		DayName     string        `json:"day_name"`
		CaptainID   *int          `json:"captain_player_id"`
		TotalPoints int           `json:"total_points"`
		Players     []PlayerScore `json:"players"`
	}

	// Get every saved day selection.
	rows, err := h.DB.Query(
		ctx,
		`SELECT
			s.id,
			s.tournament_day_id,
			td.name,
			s.captain_player_id
		 FROM fantasy_team_day_selections s
		 JOIN tournament_days td
			ON td.id = s.tournament_day_id
		 WHERE s.fantasy_team_id = $1
		 ORDER BY s.tournament_day_id`,
		fantasyTeamID,
	)

	if err != nil {
		http.Error(w, "Failed to get fantasy team selections", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Selection struct {
		ID        int
		DayID     int
		DayName   string
		CaptainID *int
	}

	var selections []Selection

	for rows.Next() {
		var selection Selection

		if err := rows.Scan(
			&selection.ID,
			&selection.DayID,
			&selection.DayName,
			&selection.CaptainID,
		); err != nil {
			http.Error(w, "Failed to read fantasy team selection", http.StatusInternalServerError)
			return
		}

		selections = append(selections, selection)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading selections", http.StatusInternalServerError)
		http.Error(w, "Error reading selections: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Used to provide the old top-level "players" response too.
	aggregate := make(map[int]*PlayerScore)

	var dayScores []DayScore
	totalPoints := 0

	for _, selection := range selections {
		playerRows, err := h.DB.Query(
			ctx,
			`SELECT player_id
			 FROM fantasy_team_day_players
			 WHERE selection_id = $1
			 ORDER BY player_id`,
			selection.ID,
		)

		if err != nil {
			http.Error(w, "Failed to get day players", http.StatusInternalServerError)
			return
		}

		var playerIDs []int

		for playerRows.Next() {
			var playerID int

			if err := playerRows.Scan(&playerID); err != nil {
				playerRows.Close()
				http.Error(w, "Failed to read day player", http.StatusInternalServerError)
				return
			}

			playerIDs = append(playerIDs, playerID)
		}

		playerRows.Close()

		dayPlayers := make(map[int]*PlayerScore)

		for _, playerID := range playerIDs {
			dayPlayers[playerID] = &PlayerScore{
				PlayerID: playerID,
				Captain:  selection.CaptainID != nil && playerID == *selection.CaptainID,
				Rooms:    []RoomScore{},
			}

			if _, exists := aggregate[playerID]; !exists {
				aggregate[playerID] = &PlayerScore{
					PlayerID: playerID,
					Rooms:    []RoomScore{},
				}
			}
		}

		// Get statistics ONLY from this tournament day.
		statRows, err := h.DB.Query(
			ctx,
			`SELECT
				prs.player_id,
				prs.room_id,
				COALESCE(prs.kills, 0),
				COALESCE(prs.assists, 0),
				COALESCE(prs.first_blood, false),
				COALESCE(prs.placement, 0)
			FROM player_room_stats prs
			JOIN rooms r
				ON r.id = prs.room_id
			WHERE r.tournament_day_id = $1
				AND prs.player_id = ANY($2)
			ORDER BY prs.player_id, prs.room_id`,
			selection.DayID,
			playerIDs,
		)

		if err != nil {
			http.Error(w, "Failed to get player statistics", http.StatusInternalServerError)
			return
		}

		for statRows.Next() {
			var (
				playerID   int
				roomID     int
				kills      int
				assists    int
				firstBlood bool
				placement  int
			)

			if err := statRows.Scan(
				&playerID,
				&roomID,
				&kills,
				&assists,
				&firstBlood,
				&placement,
			); err != nil {
				statRows.Close()
				http.Error(w, "Failed to read player statistics", http.StatusInternalServerError)
				return
			}

			points := scoring.PlayerRoomPoints(
				kills,
				assists,
				firstBlood,
				placement,
			)

			roomScore := RoomScore{
				RoomID:     roomID,
				Kills:      kills,
				Assists:    assists,
				FirstBlood: firstBlood,
				Placement:  placement,
				Points:     points,
			}

			if player := dayPlayers[playerID]; player != nil {
				player.Rooms = append(player.Rooms, roomScore)
				player.TotalPoints += points
			}

			aggregate[playerID].Rooms = append(
				aggregate[playerID].Rooms,
				roomScore,
			)

			aggregate[playerID].TotalPoints += points
		}

		statRows.Close()

		dayPlayerScores := make([]PlayerScore, 0, len(dayPlayers))
		var dayTotal int

		for _, player := range dayPlayers {
			if player.Captain {
				player.TotalPoints *= 2
			}

			dayTotal += player.TotalPoints
			dayPlayerScores = append(dayPlayerScores, *player)
		}

		sort.Slice(dayPlayerScores, func(i, j int) bool {
			return dayPlayerScores[i].PlayerID < dayPlayerScores[j].PlayerID
		})

		dayScores = append(dayScores, DayScore{
			DayID:       selection.DayID,
			DayName:     selection.DayName,
			CaptainID:   selection.CaptainID,
			TotalPoints: dayTotal,
			Players:     dayPlayerScores,
		})

		totalPoints += dayTotal
	}

	aggregateScores := make([]PlayerScore, 0, len(aggregate))

	for _, player := range aggregate {
		aggregateScores = append(aggregateScores, *player)
	}

	sort.Slice(aggregateScores, func(i, j int) bool {
		return aggregateScores[i].PlayerID < aggregateScores[j].PlayerID
	})

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"fantasy_team_id": fantasyTeamID,
		"total_points":    totalPoints,
		"players":         aggregateScores,
		"days":            dayScores,
	})
}

func (h *FantasyTeamHandler) GetMyFantasyTeam(w http.ResponseWriter, r *http.Request) {
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

	ctx := context.Background()

	var fantasyTeam models.FantasyTeam

	err = h.DB.QueryRow(
		ctx,
		`SELECT id, user_id
		 FROM fantasy_teams
		 WHERE user_id = $1`,
		userID,
	).Scan(
		&fantasyTeam.ID,
		&fantasyTeam.UserID,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Fantasy team not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to get fantasy team", http.StatusInternalServerError)
		return
	}

	type DaySelection struct {
		ID              int    `json:"id"`
		DayID           int    `json:"day_id"`
		DayName         string `json:"day_name"`
		PlayerIDs       []int  `json:"player_ids"`
		CaptainPlayerID *int   `json:"captain_player_id"`
	}

	rows, err := h.DB.Query(
		ctx,
		`SELECT
			s.id,
			s.tournament_day_id,
			td.name,
			s.captain_player_id
		 FROM fantasy_team_day_selections s
		 JOIN tournament_days td
			ON td.id = s.tournament_day_id
		 WHERE s.fantasy_team_id = $1
		 ORDER BY s.tournament_day_id`,
		fantasyTeam.ID,
	)

	if err != nil {
		http.Error(w, "Failed to get fantasy team selections", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var selections []DaySelection

	for rows.Next() {
		var selection DaySelection

		if err := rows.Scan(
			&selection.ID,
			&selection.DayID,
			&selection.DayName,
			&selection.CaptainPlayerID,
		); err != nil {
			http.Error(w, "Failed to read fantasy team selection", http.StatusInternalServerError)
			return
		}

		playerRows, err := h.DB.Query(
			ctx,
			`SELECT player_id
			 FROM fantasy_team_day_players
			 WHERE selection_id = $1
			 ORDER BY player_id`,
			selection.ID,
		)

		if err != nil {
			http.Error(w, "Failed to get day players", http.StatusInternalServerError)
			return
		}

		for playerRows.Next() {
			var playerID int

			if err := playerRows.Scan(&playerID); err != nil {
				playerRows.Close()
				http.Error(w, "Failed to read day player", http.StatusInternalServerError)
				return
			}

			selection.PlayerIDs = append(selection.PlayerIDs, playerID)
		}

		playerRows.Close()

		selections = append(selections, selection)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading selections", http.StatusInternalServerError)
		http.Error(w, "Error reading selections: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Compatibility fields: latest saved day.
	var currentPlayerIDs []int
	var currentCaptain *int
	var currentDayID *int

	if len(selections) > 0 {
		last := selections[len(selections)-1]

		currentPlayerIDs = last.PlayerIDs
		currentCaptain = last.CaptainPlayerID
		currentDayID = &last.DayID
	}

	w.Header().Set("Content-Type", "application/json")

	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                fantasyTeam.ID,
		"user_id":           fantasyTeam.UserID,
		"day_id":            currentDayID,
		"player_ids":        currentPlayerIDs,
		"captain_player_id": currentCaptain,
		"days":              selections,
	})
}
