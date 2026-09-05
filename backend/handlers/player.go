package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PlayerHandler struct {
	DB *pgxpool.Pool
}

type PlayerProfile struct {
	ID         int    `json:"id"`
	TeamID     int    `json:"team_id"`
	Nickname   string `json:"nickname"`
	PictureURL string `json:"picture_url"`
}

type PlayerRoomStat struct {
	RoomID     int  `json:"room_id"`
	RoomNumber int  `json:"room_number"`
	Kills      int  `json:"kills"`
	Assists    int  `json:"assists"`
	FirstBlood bool `json:"first_blood"`
	Placement  int  `json:"placement"`
	Points     int  `json:"points"`
}

type PlayerDayStats struct {
	ID    int              `json:"id"`
	Name  string           `json:"name"`
	Rooms []PlayerRoomStat `json:"rooms"`
	Total PlayerDayTotal   `json:"total"`
}

type PlayerDayTotal struct {
	Kills      int `json:"kills"`
	Assists    int `json:"assists"`
	FirstBlood int `json:"first_blood"`
	Points     int `json:"points"`
}

type PlayerStatsResponse struct {
	Player PlayerProfile    `json:"player"`
	Days   []PlayerDayStats `json:"days"`
	Total  PlayerDayTotal   `json:"total"`
}

type PlayerRanking struct {
	PlayerID   int    `json:"player_id"`
	Nickname   string `json:"nickname"`
	PictureURL string `json:"picture_url"`
	TeamID     int    `json:"team_id"`
	TeamName   string `json:"team_name"`
	Kills      int    `json:"kills"`
	Points     int    `json:"points"`
}

func (h *PlayerHandler) GetPlayerStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	playerID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || playerID <= 0 {
		http.Error(w, "Invalid player ID", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	var player PlayerProfile

	err = h.DB.QueryRow(
		ctx,
		`SELECT id, team_id, nickname, COALESCE(picture_url, '')
		 FROM players
		 WHERE id = $1`,
		playerID,
	).Scan(
		&player.ID,
		&player.TeamID,
		&player.Nickname,
		&player.PictureURL,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			http.Error(w, "Player not found", http.StatusNotFound)
			return
		}

		http.Error(w, "Failed to get player", http.StatusInternalServerError)
		return
	}

	rows, err := h.DB.Query(
		ctx,
		`SELECT
			td.id,
			td.name,
			r.id,
			r.room_number,
			prs.kills,
			prs.assists,
			prs.first_blood,
			prs.placement
		FROM player_room_stats prs
		JOIN rooms r
			ON r.id = prs.room_id
		JOIN tournament_days td
			ON td.id = r.tournament_day_id
		WHERE prs.player_id = $1
		ORDER BY td.id, r.room_number`,
		playerID,
	)

	if err != nil {
		http.Error(w, "Failed to get player statistics", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	daysMap := make(map[int]*PlayerDayStats)
	var dayOrder []int

	overallTotal := PlayerDayTotal{}

	for rows.Next() {
		var (
			dayID      int
			dayName    string
			roomID     int
			roomNumber int
			kills      int
			assists    int
			firstBlood bool
			placement  int
		)

		if err := rows.Scan(
			&dayID,
			&dayName,
			&roomID,
			&roomNumber,
			&kills,
			&assists,
			&firstBlood,
			&placement,
		); err != nil {
			http.Error(w, "Failed to read player statistics", http.StatusInternalServerError)
			return
		}

		points := calculatePlayerPoints(
			kills,
			assists,
			firstBlood,
			placement,
		)

		day, exists := daysMap[dayID]

		if !exists {
			day = &PlayerDayStats{
				ID:    dayID,
				Name:  dayName,
				Rooms: []PlayerRoomStat{},
			}

			daysMap[dayID] = day
			dayOrder = append(dayOrder, dayID)
		}

		day.Rooms = append(day.Rooms, PlayerRoomStat{
			RoomID:     roomID,
			RoomNumber: roomNumber,
			Kills:      kills,
			Assists:    assists,
			FirstBlood: firstBlood,
			Placement:  placement,
			Points:     points,
		})

		day.Total.Kills += kills
		day.Total.Assists += assists
		day.Total.Points += points

		if firstBlood {
			day.Total.FirstBlood++
		}

		overallTotal.Kills += kills
		overallTotal.Assists += assists
		overallTotal.Points += points

		if firstBlood {
			overallTotal.FirstBlood++
		}
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to read player statistics", http.StatusInternalServerError)
		return
	}

	days := make([]PlayerDayStats, 0, len(dayOrder))

	for _, dayID := range dayOrder {
		days = append(days, *daysMap[dayID])
	}

	response := PlayerStatsResponse{
		Player: player,
		Days:   days,
		Total:  overallTotal,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func calculatePlayerPoints(
	kills int,
	assists int,
	firstBlood bool,
	placement int,
) int {
	points := kills * 10
	points += assists * 5

	if firstBlood {
		points += 5
	}

	switch placement {
	case 1:
		points += 15
	case 2:
		points += 12
	case 3:
		points += 10
	case 4:
		points += 8
	case 5:
		points += 6
	case 6:
		points += 5
	case 7:
		points += 4
	case 8:
		points += 3
	case 9:
		points += 2
	case 10:
		points += 1
	}

	return points
}

func (h *PlayerHandler) GetPlayerRankings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dayID := r.URL.Query().Get("day_id")
	sortBy := r.URL.Query().Get("sort")

	if sortBy == "" {
		sortBy = "points"
	}

	if sortBy != "points" && sortBy != "kills" {
		http.Error(w, "Invalid sort", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	query := `
		SELECT
			p.id,
			p.nickname,
			COALESCE(p.picture_url, ''),
			p.team_id,
			t.name,
			SUM(prs.kills)::int AS kills,
			SUM(
				prs.kills * 10 +
				prs.assists * 5 +
				CASE WHEN prs.first_blood THEN 5 ELSE 0 END +
				CASE prs.placement
					WHEN 1 THEN 15
					WHEN 2 THEN 12
					WHEN 3 THEN 10
					WHEN 4 THEN 8
					WHEN 5 THEN 6
					WHEN 6 THEN 5
					WHEN 7 THEN 4
					WHEN 8 THEN 3
					WHEN 9 THEN 2
					WHEN 10 THEN 1
					ELSE 0
				END
			)::int AS points
		FROM player_room_stats prs
		JOIN rooms r
			ON r.id = prs.room_id
		JOIN players p
			ON p.id = prs.player_id
		JOIN teams t
			ON t.id = p.team_id
	`

	args := []any{}

	if dayID != "" {
		id, err := strconv.Atoi(dayID)
		if err != nil || id <= 0 {
			http.Error(w, "Invalid day ID", http.StatusBadRequest)
			return
		}

		query += ` WHERE r.tournament_day_id = $1`
		args = append(args, id)
	}

	query += `
		GROUP BY
			p.id,
			p.nickname,
			p.picture_url,
			p.team_id,
			t.name
	`

	if sortBy == "kills" {
		query += ` ORDER BY kills DESC, p.nickname ASC`
	} else {
		query += ` ORDER BY points DESC, p.nickname ASC`
	}

	rows, err := h.DB.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, "Failed to get player rankings", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	rankings := []PlayerRanking{}

	for rows.Next() {
		var ranking PlayerRanking

		if err := rows.Scan(
			&ranking.PlayerID,
			&ranking.Nickname,
			&ranking.PictureURL,
			&ranking.TeamID,
			&ranking.TeamName,
			&ranking.Kills,
			&ranking.Points,
		); err != nil {
			http.Error(w, "Failed to read player rankings", http.StatusInternalServerError)
			return
		}

		rankings = append(rankings, ranking)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Failed to read player rankings", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rankings)
}
