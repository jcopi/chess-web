package main

import "net/http"

func main() {
	mux := http.NewServeMux()

	staticFileHandler := http.FileServerFS(Resources)

	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")

		staticFileHandler.ServeHTTP(w, r)
	}))

	http.ListenAndServe(":http", mux)
}
