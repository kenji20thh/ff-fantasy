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

	sessionStore := handlers.NewSessionStore()

	fantasyTeamHandler := &handlers.FantasyTeamHandler{
		DB:       conn,
		Sessions: sessionStore,
	}

	authHandler := &handlers.AuthHandler{
		DB:       conn,
		Sessions: sessionStore,
	}

	adminTeamHandler := &handlers.AdminTeamHandler{
		DB: conn,
	}

	adminPlayerHandler := &handlers.AdminPlayerHandler{
		DB: conn,
	}

	adminStatsHandler := &handlers.AdminStatsHandler{
		DB: conn,
	}

	http.HandleFunc("/api/teams", teamHandler.GetTeams)
	http.HandleFunc("/api/teams/{id}/players", teamHandler.GetPlayers)

	http.HandleFunc("/api/fantasy-teams", fantasyTeamHandler.CreateFantasyTeam)
	http.HandleFunc("/api/fantasy-teams/{id}", fantasyTeamHandler.GetFantasyTeam)
	http.HandleFunc("/api/fantasy-teams/{id}/players", fantasyTeamHandler.SelectPlayers)
	http.HandleFunc("/api/fantasy-teams/{id}/captain", fantasyTeamHandler.SetCaptain)
	http.HandleFunc("/api/fantasy-teams/{id}/points", fantasyTeamHandler.GetFantasyTeamPoints)

	http.HandleFunc("/api/register", authHandler.Register)
	http.HandleFunc("/api/login", authHandler.Login)
	http.HandleFunc("/api/me", authHandler.Me)

	http.HandleFunc(
		"/api/admin/teams",
		handlers.RequireAdmin(
			conn,
			sessionStore,
			adminTeamHandler.CreateTeam,
		),
	)

	http.HandleFunc(
		"/api/admin/teams/{id}",
		handlers.RequireAdmin(
			conn,
			sessionStore,
			adminTeamHandler.ManageTeam,
		),
	)

	http.HandleFunc(
		"/api/admin/players",
		handlers.RequireAdmin(
			conn,
			sessionStore,
			adminPlayerHandler.CreatePlayer,
		),
	)

	http.HandleFunc(
		"/api/admin/players/{id}",
		handlers.RequireAdmin(
			conn,
			sessionStore,
			adminPlayerHandler.ManagePlayer,
		),
	)

	http.HandleFunc(
		"/api/admin/rooms/{room_id}/stats/{player_id}",
		handlers.RequireAdmin(
			conn,
			sessionStore,
			adminStatsHandler.ManageStats,
		),
	)

	fmt.Println("Server running on http://localhost:8080")

	err = http.ListenAndServe(":8080", nil)
	if err != nil {
		fmt.Println(err)
	}
}
