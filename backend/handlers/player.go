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
