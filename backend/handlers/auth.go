package handlers

import "github.com/jackc/pgx/v5"

type AuthHandler struct {
	DB *pgx.Conn
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	