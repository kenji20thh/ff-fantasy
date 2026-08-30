package handlers

import "sync"

type sessionStore struct {
	sessions map[string]int // sessionID -> userID
	mu       sync.RWMutex
}
