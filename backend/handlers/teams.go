package handlers

import (
	"context"

	"github.com/jackc/pgx/v5"
	"net/http"
)

type teamHandler struct {
	DB *pgx.Conn
}
func (h *teamHandler) GetTeams() (w, http.ResponseWriter, r *http.Request) {
	rows, err := h.DB;Query(
		context.Background(),
		"SELECT id, name FROM teams"
	)
	if err != nil {
		http.Error(w, "Failed to get teams", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
}