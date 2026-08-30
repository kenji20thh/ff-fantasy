package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
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

func (s *sessionStore) GetUserID(sessionID string) (int, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	userID, exists := s.sessions[sessionID]
	return userID, exists
}

func (s *sessionStore) SetCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})
}
