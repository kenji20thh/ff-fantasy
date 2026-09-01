package database

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect() (*pgxpool.Pool, error) {
	connString := os.Getenv("DATABASE_URL")
	if connString == "" {
		return nil, fmt.Errorf(
			"DATABASE_URL environment variable is not set",
		)
	}

	pool, err := pgxpool.New(
		context.Background(),
		connString,
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
