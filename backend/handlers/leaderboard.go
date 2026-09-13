package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"

	"ff-fantasy/scoring"
)

type LeaderboardHandler struct {
	DB *pgxpool.Pool
}

type leaderboardEntry struct {
	Rank          int    `json:"rank"`
	Username      string `json:"username"`
	FantasyTeamID int    `json:"fantasy_team_id"`
	Points        int    `json:"points"`
}

func (h *LeaderboardHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dayID := 0

	if value := r.URL.Query().Get("day_id"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			http.Error(w, "Invalid day_id", http.StatusBadRequest)
			return
		}

		dayID = parsed
	}

	ctx := context.Background()

	type teamScore struct {
		ID          int
		Username    string
		TotalPoints int
	}

	teams := make(map[int]*teamScore)

	// Seed every fantasy team so teams with no picks yet still show 0.
	teamRows, err := h.DB.Query(
		ctx,
		`SELECT ft.id, u.username
		 FROM fantasy_teams ft
		 JOIN users u
			ON u.id = ft.user_id`,
	)

	if err != nil {
		http.Error(w, "Failed to get fantasy teams", http.StatusInternalServerError)
		return
	}

	for teamRows.Next() {
		var id int
		var username string

		if err := teamRows.Scan(&id, &username); err != nil {
			teamRows.Close()
			http.Error(w, "Failed to read fantasy team", http.StatusInternalServerError)
			return
		}

		teams[id] = &teamScore{ID: id, Username: username}
	}

	if err := teamRows.Err(); err != nil {
		teamRows.Close()
		http.Error(w, "Error reading fantasy teams", http.StatusInternalServerError)
		return
	}

	teamRows.Close()

	// Get every saved day selection (optionally filtered to one day).
	type selection struct {
		ID            int
		FantasyTeamID int
		DayID         int
		CaptainID     *int
	}

	var selections []selection

	if dayID == 0 {
		selRows, err := h.DB.Query(
			ctx,
			`SELECT id, fantasy_team_id, tournament_day_id, captain_player_id
			 FROM fantasy_team_day_selections
			 ORDER BY fantasy_team_id`,
		)

		if err != nil {
			http.Error(w, "Failed to get day selections", http.StatusInternalServerError)
			return
		}

		for selRows.Next() {
			var s selection

			if err := selRows.Scan(&s.ID, &s.FantasyTeamID, &s.DayID, &s.CaptainID); err != nil {
				selRows.Close()
				http.Error(w, "Failed to read day selection", http.StatusInternalServerError)
				return
			}

			selections = append(selections, s)
		}

		if err := selRows.Err(); err != nil {
			selRows.Close()
			http.Error(w, "Error reading day selections", http.StatusInternalServerError)
			return
		}

		selRows.Close()
	} else {
		selRows, err := h.DB.Query(
			ctx,
			`SELECT id, fantasy_team_id, tournament_day_id, captain_player_id
			 FROM fantasy_team_day_selections
			 WHERE tournament_day_id = $1
			 ORDER BY fantasy_team_id`,
			dayID,
		)

		if err != nil {
			http.Error(w, "Failed to get day selections", http.StatusInternalServerError)
			return
		}

		for selRows.Next() {
			var s selection

			if err := selRows.Scan(&s.ID, &s.FantasyTeamID, &s.DayID, &s.CaptainID); err != nil {
				selRows.Close()
				http.Error(w, "Failed to read day selection", http.StatusInternalServerError)
				return
			}

			selections = append(selections, s)
		}

		if err := selRows.Err(); err != nil {
			selRows.Close()
			http.Error(w, "Error reading day selections", http.StatusInternalServerError)
			return
		}

		selRows.Close()
	}

	for _, s := range selections {
		playerRows, err := h.DB.Query(
			ctx,
			`SELECT player_id
			 FROM fantasy_team_day_players
			 WHERE selection_id = $1
			 ORDER BY player_id`,
			s.ID,
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

		if len(playerIDs) == 0 {
			continue
		}

		playerTotals := make(map[int]int)

		for _, playerID := range playerIDs {
			playerTotals[playerID] = 0
		}

		statRows, err := h.DB.Query(
			ctx,
			`SELECT
				prs.player_id,
				COALESCE(prs.kills, 0),
				COALESCE(prs.assists, 0),
				COALESCE(prs.first_blood, false),
				COALESCE(prs.placement, 0)
			 FROM player_room_stats prs
			 JOIN rooms r
				ON r.id = prs.room_id
			 WHERE r.tournament_day_id = $1
				AND prs.player_id = ANY($2)`,
			s.DayID,
			playerIDs,
		)

		if err != nil {
			http.Error(w, "Failed to get player statistics", http.StatusInternalServerError)
			return
		}

		for statRows.Next() {
			var (
				playerID   int
				kills      int
				assists    int
				firstBlood bool
				placement  int
			)

			if err := statRows.Scan(
				&playerID,
				&kills,
				&assists,
				&firstBlood,
				&placement,
			); err != nil {
				statRows.Close()
				http.Error(w, "Failed to read player statistics", http.StatusInternalServerError)
				return
			}

			playerTotals[playerID] += scoring.PlayerRoomPoints(
				kills,
				assists,
				firstBlood,
				placement,
			)
		}

		statRows.Close()

		if err := statRows.Err(); err != nil {
			http.Error(w, "Error reading player statistics", http.StatusInternalServerError)
			return
		}

		dayTotal := 0

		for playerID, points := range playerTotals {
			if s.CaptainID != nil && playerID == *s.CaptainID {
				points *= 2
			}

			dayTotal += points
		}

		if team, exists := teams[s.FantasyTeamID]; exists {
			team.TotalPoints += dayTotal
		}
	}

	entries := make([]leaderboardEntry, 0, len(teams))

	for _, team := range teams {
		entries = append(entries, leaderboardEntry{
			Username:      team.Username,
			FantasyTeamID: team.ID,
			Points:        team.TotalPoints,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Points != entries[j].Points {
			return entries[i].Points > entries[j].Points
		}

		return entries[i].FantasyTeamID < entries[j].FantasyTeamID
	})

	for i := range entries {
		if i == 0 || entries[i].Points != entries[i-1].Points {
			entries[i].Rank = i + 1
		} else {
			entries[i].Rank = entries[i-1].Rank
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}
