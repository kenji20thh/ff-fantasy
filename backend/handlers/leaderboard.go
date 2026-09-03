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

	var (
		rows interface {
			Next() bool
			Scan(...any) error
			Err() error
			Close()
		}
		err error
	)

	if dayID == 0 {
		rows, err = h.DB.Query(
			context.Background(),
			`SELECT
				ft.id,
				u.username,
				ft.captain_player_id,
				ftp.player_id,
				prs.kills,
				prs.assists,
				prs.first_blood,
				prs.placement
			FROM fantasy_teams ft
			JOIN users u
				ON u.id = ft.user_id
			JOIN fantasy_team_players ftp
				ON ftp.fantasy_team_id = ft.id
			JOIN player_room_stats prs
				ON prs.player_id = ftp.player_id
			JOIN rooms r
				ON r.id = prs.room_id
			JOIN tournament_days td
				ON td.id = r.tournament_day_id
			WHERE
				td.deadline_at IS NULL
				OR ft.created_at < td.deadline_at
			ORDER BY ft.id`,
		)
	} else {
		rows, err = h.DB.Query(
			context.Background(),
			`SELECT
				ft.id,
				u.username,
				ft.captain_player_id,
				ftp.player_id,
				prs.kills,
				prs.assists,
				prs.first_blood,
				prs.placement
			FROM fantasy_teams ft
			JOIN users u
				ON u.id = ft.user_id
			JOIN fantasy_team_players ftp
				ON ftp.fantasy_team_id = ft.id
			JOIN player_room_stats prs
				ON prs.player_id = ftp.player_id
			JOIN rooms r
				ON r.id = prs.room_id
			JOIN tournament_days td
				ON td.id = r.tournament_day_id
			WHERE
				r.tournament_day_id = $1
				AND (
					td.deadline_at IS NULL
					OR ft.created_at < td.deadline_at
				)
			ORDER BY ft.id`,
			dayID,
		)
	}

	if err != nil {
		http.Error(w, "Failed to get leaderboard", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type teamScore struct {
		ID          int
		Username    string
		CaptainID   *int
		TotalPoints int
	}

	teams := make(map[int]*teamScore)

	for rows.Next() {
		var (
			fantasyTeamID int
			username      string
			captainID     *int
			playerID      int
			kills         int
			assists       int
			firstBlood    bool
			placement     int
		)

		err := rows.Scan(
			&fantasyTeamID,
			&username,
			&captainID,
			&playerID,
			&kills,
			&assists,
			&firstBlood,
			&placement,
		)

		if err != nil {
			http.Error(w, "Failed to read leaderboard data", http.StatusInternalServerError)
			return
		}

		if _, exists := teams[fantasyTeamID]; !exists {
			teams[fantasyTeamID] = &teamScore{
				ID:          fantasyTeamID,
				Username:    username,
				CaptainID:   captainID,
				TotalPoints: 0,
			}
		}

		points := scoring.PlayerRoomPoints(
			kills,
			assists,
			firstBlood,
			placement,
		)

		if captainID != nil && playerID == *captainID {
			points *= 2
		}

		teams[fantasyTeamID].TotalPoints += points
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error reading leaderboard", http.StatusInternalServerError)
		return
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
		return entries[i].Points > entries[j].Points
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
