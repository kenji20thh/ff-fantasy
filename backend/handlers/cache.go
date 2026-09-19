package handlers

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"time"
)

type cacheEntry struct {
	status      int
	contentType string
	body        []byte
	expiresAt   time.Time
}

type ResponseCache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
}

func NewResponseCache() *ResponseCache {
	return &ResponseCache{
		entries: make(map[string]cacheEntry),
	}
}

func CacheGET(cache *ResponseCache, ttl time.Duration, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			next(w, r)
			return
		}

		key := r.URL.String()

		cache.mu.RLock()
		entry, found := cache.entries[key]
		cache.mu.RUnlock()

		if found && time.Now().Before(entry.expiresAt) {
			if entry.contentType != "" {
				w.Header().Set("Content-Type", entry.contentType)
			}
			w.Header().Set("X-Cache", "HIT")
			w.WriteHeader(entry.status)
			w.Write(entry.body)
			return
		}

		recorder := httptest.NewRecorder()
		next(recorder, r)

		result := recorder.Result()
		body := recorder.Body.Bytes()

		if result.StatusCode == http.StatusOK {
			cache.mu.Lock()
			cache.entries[key] = cacheEntry{
				status:      result.StatusCode,
				contentType: result.Header.Get("Content-Type"),
				body:        body,
				expiresAt:   time.Now().Add(ttl),
			}
			cache.mu.Unlock()
		}

		for headerKey, values := range result.Header {
			for _, value := range values {
				w.Header().Add(headerKey, value)
			}
		}

		w.Header().Set("X-Cache", "MISS")
		w.WriteHeader(result.StatusCode)
		w.Write(body)
	}
}
