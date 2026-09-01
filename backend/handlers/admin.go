package handlers

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func RequireAdmin(
	db *pgxpool.Pool,
	sessions *SessionStore,
	next http.HandlerFunc,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_id")
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		userID, exists := sessions.GetUserID(cookie.Value)
		if !exists {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var role string

		err = db.QueryRow(
			context.Background(),
			"SELECT role FROM users WHERE id = $1",
			userID,
		).Scan(&role)

		if err != nil {
			if err == pgx.ErrNoRows {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			http.Error(w, "Failed to check user role", http.StatusInternalServerError)
			return
		}

		if role != "admin" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	}
}
