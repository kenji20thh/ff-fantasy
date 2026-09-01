package database

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect() (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(
		context.Background(),
		"postgres://kenji20th:MrR@b@!@localhost:5432/ff_fantasy",
	)

	if err != nil {
		return nil, err
	}

	err = pool.Ping(context.Background())
	if err != nil {
		pool.Close()
		return nil, err
	}

	return pool, nil
}

func Context() context.Context {
	return context.Background()
}
