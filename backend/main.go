package main

import (
	"fmt"
	"net/http"

	"ff-fantasy/database"
	"ff-fantasy/handlers"

	"github.com/joho/godotenv"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS",
		)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// Handle CORS preflight requests.
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	godotenv.Load()

	conn, err := database.Connect()
	if err != nil {
		fmt.Println("Error connecting to PostgreSQL:", err)
		return
	}
	defer conn.Close()

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

	adminTournamentDayHandler := &handlers.AdminTournamentDayHandler{
		DB: conn,
	}

	leaderboardHandler := &handlers.LeaderboardHandler{
		DB: conn,
	}

	http.HandleFunc("/api/teams", teamHandler.GetTeams)
	http.HandleFunc("/api/teams/{id}/players", teamHandler.GetPlayers)

	http.HandleFunc("/api/fantasy-teams", fantasyTeamHandler.CreateFantasyTeam)
	http.HandleFunc("/api/fantasy-teams/{id}", fantasyTeamHandler.GetFantasyTeam)
	http.HandleFunc("/api/fantasy-teams/{id}/players", fantasyTeamHandler.SelectPlayers)
	http.HandleFunc("/api/fantasy-teams/{id}/captain", fantasyTeamHandler.SetCaptain)
	http.HandleFunc("/api/fantasy-teams/{id}/points", fantasyTeamHandler.GetFantasyTeamPoints)

	http.HandleFunc("/api/rooms/{id}/stats", teamHandler.GetRoomStats)
	http.HandleFunc("/api/leaderboard", leaderboardHandler.GetLeaderboard)

	http.HandleFunc("/api/register", authHandler.Register)
	http.HandleFunc("/api/login", authHandler.Login)
	http.HandleFunc("/api/logout", authHandler.Logout)
	http.HandleFunc("/api/me", authHandler.Me)

	http.HandleFunc(
		"/api/tournament-days",
		adminTournamentDayHandler.GetTournamentDays,
	)

	http.HandleFunc(
		"/api/tournament-days/{id}",
		adminTournamentDayHandler.GetTournamentDay,
	)

	http.HandleFunc(
		"/api/tournament-days/{id}/rooms",
		adminTournamentDayHandler.GetTournamentDayRooms,
	)

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

	http.HandleFunc(
		"/api/admin/tournament-days",
		handlers.RequireAdmin(
			conn,
			sessionStore,
			adminTournamentDayHandler.ManageTournamentDays,
		),
	)

	http.HandleFunc(
		"/api/admin/tournament-days/{id}",
		handlers.RequireAdmin(
			conn,
			sessionStore,
			adminTournamentDayHandler.ManageTournamentDay,
		),
	)

	fmt.Println("Server running on http://localhost:8080")

	if err := http.ListenAndServe(":8080", corsMiddleware(http.DefaultServeMux)); err != nil {
		fmt.Println(err)
	}
}
