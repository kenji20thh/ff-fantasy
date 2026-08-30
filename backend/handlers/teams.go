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
}