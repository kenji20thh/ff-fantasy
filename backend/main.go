package main

import (
	"fmt"
	"net/http"

	"ff-fantasy/database"
	"ff-fantasy/handlers"
)

func main() {
	conn, err := database.Connect()
	if err != nil {
		fmt.Println("Error connecting to PostgreSQL:", err)
		return
	}
	defer conn.Close(database.Context())

	fmt.Println("Connected to PostgreSQL")

	teamHandler := &handlers.TeamHandler{
		DB: conn,
	}

	fantasyTeamHandler := &handlers.FantasyTeamHandler{
		DB: conn,
	}

	authHandler := &handlers.AuthHandler{
		DB: conn,
	}

	http.HandleFunc("/api/teams", teamHandler.GetTeams)
	http.HandleFunc("/api/teams/{id}/players", teamHandler.GetPlayers)

	http.HandleFunc("/api/fantasy-teams", fantasyTeamHandler.CreateFantasyTeam)
	http.HandleFunc("/api/fantasy-teams/{id}/players", fantasyTeamHandler.SelectPlayers)

	http.HandleFunc("/api/register", authHandler.Register)

	fmt.Println("Server running on http://localhost:8080")

	err = http.ListenAndServe(":8080", nil)
	if err != nil {
		fmt.Println(err)
	}
}
