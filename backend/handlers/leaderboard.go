package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"

	"github.com/jackc/pgx/v5"

	"ff-fantasy/scoring"
)

type LeaderboardHandler struct {
	DB *pgx.Conn
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

	rows, err := h.DB.Query(
		context.Background(),
		`SELECT
			ft.id,
			u.username,
			ft.captain_player_id,
			ftp.player_id,
			COALESCE(prs.kills, 0),
			COALESCE(prs.assists, 0),
			COALESCE(prs.first_blood, false),
			COALESCE(prs.placement, 0)
		FROM fantasy_teams ft
		JOIN users u
			ON u.id = ft.user_id
		JOIN fantasy_team_players ftp
			ON ftp.fantasy_team_id = ft.id
		LEFT JOIN player_room_stats prs
			ON prs.player_id = ftp.player_id
		ORDER BY ft.id`,
	)

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
