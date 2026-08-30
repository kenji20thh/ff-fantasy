package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
)

type sessionStore struct {
	sessions map[string]int // sessionID -> userID
	mu       sync.RWMutex
}

func newSessionStore() *sessionStore {
	return &sessionStore{
		sessions: make(map[string]int),
	}
}

func (s *sessionStore) Create(userID int) (string, error) {
	bytes := make([]byte, 32)

	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}

	sessionID := hex.EncodeToString(bytes)

	s.mu.Lock()
	s.sessions[sessionID] = userID
	s.mu.Unlock()

	return sessionID, nil

}
