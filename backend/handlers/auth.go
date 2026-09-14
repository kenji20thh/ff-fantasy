package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"ff-fantasy/models"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB       *pgxpool.Pool
	Sessions *SessionStore
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.Username == "" || request.Email == "" || request.Password == "" {
		http.Error(w, "Username, email and password are required", http.StatusBadRequest)
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword(
		[]byte(request.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	var user models.User

	err = h.DB.QueryRow(
		context.Background(),
		`INSERT INTO users (username, email, password_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id, username, email, role`,
		request.Username,
		request.Email,
		string(passwordHash),
	).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.Role,
	)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			http.Error(w, "Username or email is already taken", http.StatusConflict)
			return
		}

		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	// Automatically log the newly registered user in.
	sessionID, err := h.Sessions.Create(user.ID)
	if err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	h.Sessions.SetCookie(w, sessionID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	json.NewEncoder(w).Encode(user)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.Identifier == "" || request.Password == "" {
		http.Error(w, "Username or email and password are required", http.StatusBadRequest)
		return
	}

	var user models.User
	var passwordHash string

	err := h.DB.QueryRow(
		context.Background(),
		`SELECT id, username, email, password_hash, role
		 FROM users
		 WHERE email = $1 OR username = $1`,
		request.Identifier,
	).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&passwordHash,
		&user.Role,
	)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)

		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid username/email or password",
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(passwordHash),
		[]byte(request.Password),
	); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)

		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid username/email or password",
		})
		return
	}

	sessionID, err := h.Sessions.Create(user.ID)
	if err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	h.Sessions.SetCookie(w, sessionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}

	userID, exists := h.Sessions.GetUserID(cookie.Value)
	if !exists {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}

	var user models.User

	err = h.DB.QueryRow(
		context.Background(),
		`SELECT id, username, email, role
		 FROM users
		 WHERE id = $1`,
		userID,
	).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.Role,
	)

	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_id")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, exists := h.Sessions.GetUserID(cookie.Value)
	if !exists {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var request struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.OldPassword == "" || request.NewPassword == "" {
		http.Error(w, "Old and new password are required", http.StatusBadRequest)
		return
	}

	if len(request.NewPassword) < 8 {
		http.Error(w, "New password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	var currentHash string

	err = h.DB.QueryRow(
		context.Background(),
		`SELECT password_hash
		 FROM users
		 WHERE id = $1`,
		userID,
	).Scan(&currentHash)

	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if err := bcrypt.CompareHashAndPassword(
		[]byte(currentHash),
		[]byte(request.OldPassword),
	); err != nil {
		http.Error(w, "Current password is incorrect", http.StatusUnauthorized)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword(
		[]byte(request.NewPassword),
		bcrypt.DefaultCost,
	)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	_, err = h.DB.Exec(
		context.Background(),
		`UPDATE users
		 SET password_hash = $1
		 WHERE id = $2`,
		string(newHash),
		userID,
	)

	if err != nil {
		http.Error(w, "Failed to update password", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Password updated successfully",
	})
}
