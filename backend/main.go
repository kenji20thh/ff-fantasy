package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5"
)

type Team struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func main() {
	conn, err := pgx.Connect(
		context.Background(),
		"postgres://kenji20th:MrR@b@!@localhost:5432/ff_fantasy",
	)
	if err != nil {
		fmt.Println("Error connecting to the database:", err)
		return
	}
	defer conn.Close(context.Background())

	err = conn.Ping(context.Background())
	if err != nil {
		fmt.Println("Database ping failed:", err)
		return
	}

	var dbName string
	err = conn.QueryRow(context.Background(), "SELECT current_database()").Scan(&dbName)
	if err != nil {
		fmt.Println("Error retrieving database name:", err)
		return
	}
	fmt.Println("Connected to PostgreSQL database:", dbName)

	fmt.Println("Connected to PostgreSQL")

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "FF Fantasy API")
	})

	http.HandleFunc("/api/teams", func(w http.ResponseWriter, r *http.Request) {
		rows, err := conn.Query(context.Background(), "SELECT id, name FROM teams")
		if err != nil {
			http.Error(w, "Failed to get teams", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var teams []Team

		for rows.Next() {
			var team Team

			err := rows.Scan(&team.ID, &team.Name)
			if err != nil {
				http.Error(w, "Failed to read team", http.StatusInternalServerError)
				return
			}

			teams = append(teams, team)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, "Error reading rows", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(teams)
	})

	http.HandleFunc("/api/teams/{id}/players", func(w http.ResponseWriter, r *http.Request) {

		id := r.PathValue("id")
		rows, err := conn.Query(
			context.Background(),
			"SELECT id, nickname FROM players WHERE team_id = $1",
			id,
		)
		if err != nil {
			http.Error(w, "Failed to get players", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type Player struct {
			ID       int    `json:"id"`
			Nickname string `json:"nickname"`
		}

		players := []Player{}

		for rows.Next() {
			var player Player

			err := rows.Scan(&player.ID, &player.Nickname)
			if err != nil {
				http.Error(w, "Failed to read player", http.StatusInternalServerError)
				return
			}

			players = append(players, player)
		}

		if err := rows.Err(); err != nil {
			http.Error(w, "Error reading rows", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(players)
	})

	http.HandleFunc("/api/fantasy-teams", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var request struct {
			UserID int `json:"user_id"`
		}
		err := json.NewDecoder(r.Body).Decode(&request)
		if err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		var fanatasyTeamID int
		err = conn.QueryRow(
			context.Background(),
			"INSERT INTO fantasy_teams (user_id) VALUES ($1) RETURNING Id",
			request.UserID,
		).Scan(&fanatasyTeamID)

		if err != nil {
			fmt.Println("Error creating fantasy team:", err)
			http.Error(w, "Failed to create fantasy team", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"fantasy_team_id": fanatasyTeamID})
	})

	fmt.Println("Server running on http://localhost:8080")

	err = http.ListenAndServe(":8080", nil)
	if err != nil {
		fmt.Println(err)
	}
}
