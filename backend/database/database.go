package database

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func Connect() (*pgx.Conn, error) {
	conn, err := pgx.Connect(
		context.Background(),
		"postgres://kenji20th:MrR@b@!@localhost:5432/ff_fantasy",
	)

	if err != nil {
		return nil, err
	}

	err = conn.Ping(context.Background())
	if err != nil {
		conn.Close(context.Background())
		return nil, err
	}

	return conn, nil
}

func Context() context.Context {
	return context.Background()
}
