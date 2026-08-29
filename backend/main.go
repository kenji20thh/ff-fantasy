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
		fmt.Println("Error pinging the database:", err)
		return
	}

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
				http.Error(w, "Failed to scan team", http.StatusInternalServerError)
				return
			}
			teams = append(teams, team)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(teams)
	})

	fmt.Println("Server running on http://localhost:8080")

	err = http.ListenAndServe(":8080", nil)
	if err != nil {
		fmt.Println(err)
	}
}
