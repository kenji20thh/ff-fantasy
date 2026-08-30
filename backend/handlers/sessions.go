package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
)

type SessionStore struct {
	sessions map[string]int
	mu       sync.RWMutex
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]int),
	}
}

func (s *SessionStore) Create(userID int) (string, error) {
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

func (s *SessionStore) GetUserID(sessionID string) (int, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	userID, exists := s.sessions[sessionID]

	return userID, exists
}

func (s *SessionStore) SetCookie(w http.ResponseWriter, sessionID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})
}
