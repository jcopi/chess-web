package main

import "net/http"

func Handlers(handlers ...http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, handler := range handlers {
			handler.ServeHTTP(w, r)
		}
	})
}

func corsHeaders(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
}

func main() {
	mux := http.NewServeMux()
	mux.Handle("/", Handlers(http.HandlerFunc(corsHeaders), http.FileServerFS(Resources)))

	http.ListenAndServe(":http", mux)
}
