package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

type capturingWriter struct {
	http.ResponseWriter
	code  int
	start time.Time
}

func (c *capturingWriter) WriteHeader(code int) {
	c.code = code
	c.ResponseWriter.WriteHeader(code)
}

func Handlers(handlers ...http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cw := &capturingWriter{ResponseWriter: w, start: time.Now()}

		for _, handler := range handlers {
			handler.ServeHTTP(cw, r)
		}
	})
}

func headers(w http.ResponseWriter, r *http.Request) {
	switch {
	case strings.HasPrefix(r.URL.Path, "/assets"):
		// These files all contain a hash in their names so they can be cached infinitely
		w.Header().Set("Cache-Control", "max-age=10368000, immutable")
	}
	w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
}

func logging(logger *slog.Logger) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		code := 0
		latency := 0 * time.Second

		if cw, ok := w.(*capturingWriter); ok {
			code = cw.code
			latency = time.Since(cw.start)
		}

		logger.LogAttrs(r.Context(), slog.LevelInfo, "incoming request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.String("user_agent", r.UserAgent()),
			slog.Int("status_code", code),
			slog.Duration("latency", latency),
		)
	}
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		AddSource: false,
		Level:     slog.LevelDebug,
	}))

	mux := http.NewServeMux()
	mux.Handle("/", Handlers(
		http.HandlerFunc(headers),
		http.FileServerFS(Resources),
		http.HandlerFunc(logging(logger)),
	))

	http.ListenAndServe(":8080", mux)
}
