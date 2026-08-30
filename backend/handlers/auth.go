package handlers

import "github.com/jackc/pgx/v5"

type AuthHandler struct {
	DB *pgx.Conn
}
