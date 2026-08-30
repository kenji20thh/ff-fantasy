package handlers

import (
	"net/http"

	"github.com/jackc/pgx/v5"
)

type AuthHandler struct {
	DB *pgx.Conn
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Username string `json:"username"`
		EMail    string `json:"email"`
		Password string `json:"password"`
	}

}
