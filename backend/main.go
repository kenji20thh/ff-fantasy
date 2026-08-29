package main

import (
	"context"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5"
)

func main() {
	conn, err := pgx.Connect(context.background(), "postgres://postgres://localhost/ff_fantasy")
	if err != nil {
		fmt.Println("Error connecting to the database:", err)
		return
	}
	defer conn.Close(context.Background())

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "FF Fantasy API")
	})

	fmt.Println("Server running on http://localhost:8080")

	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		fmt.Println(err)
	}
}
