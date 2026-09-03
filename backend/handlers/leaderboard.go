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

	type teamScore struct {
		ID          int
		Username    string
		CaptainID   *int
		TotalPoints int
	}

	teams := make(map[int]*teamScore)

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
				prs.player_id,
				prs.kills,
				prs.assists,
				prs.first_blood,
				prs.placement
			FROM fantasy_teams ft
			JOIN users u
				ON u.id = ft.user_id
			LEFT JOIN fantasy_team_players ftp
				ON ftp.fantasy_team_id = ft.id
			LEFT JOIN player_room_stats prs
				ON prs.player_id = ftp.player_id
				AND EXISTS (
					SELECT 1
					FROM rooms r
					JOIN tournament_days td
						ON td.id = r.tournament_day_id
					WHERE r.id = prs.room_id
						AND (
							td.deadline_at IS NULL
							OR ft.created_at < td.deadline_at
						)
				)
			ORDER BY ft.id`,
		)
	} else {
		rows, err = h.DB.Query(
			context.Background(),
			`SELECT
				ft.id,
				u.username,
				ft.captain_player_id,
				prs.player_id,
				prs.kills,
				prs.assists,
				prs.first_blood,
				prs.placement
			FROM fantasy_teams ft
			JOIN users u
				ON u.id = ft.user_id
			LEFT JOIN fantasy_team_players ftp
				ON ftp.fantasy_team_id = ft.id
			LEFT JOIN player_room_stats prs
				ON prs.player_id = ftp.player_id
				AND EXISTS (
					SELECT 1
					FROM rooms r
					JOIN tournament_days td
						ON td.id = r.tournament_day_id
					WHERE r.id = prs.room_id
						AND r.tournament_day_id = $1
						AND (
							td.deadline_at IS NULL
							OR ft.created_at < td.deadline_at
						)
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

	for rows.Next() {
		var (
			fantasyTeamID int
			username      string
			captainID     *int
			playerID      *int
			kills         *int
			assists       *int
			firstBlood    *bool
			placement     *int
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

		// No stats for this player yet.
		if playerID == nil {
			continue
		}

		playerKills := 0
		playerAssists := 0
		playerFirstBlood := false
		playerPlacement := 0

		if kills != nil {
			playerKills = *kills
		}

		if assists != nil {
			playerAssists = *assists
		}

		if firstBlood != nil {
			playerFirstBlood = *firstBlood
		}

		if placement != nil {
			playerPlacement = *placement
		}

		points := scoring.PlayerRoomPoints(
			playerKills,
			playerAssists,
			playerFirstBlood,
			playerPlacement,
		)

		if captainID != nil && *playerID == *captainID {
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
