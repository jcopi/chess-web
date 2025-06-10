.PHONY: env
env:
    podman run -it -p 5173:5173 -v ./:/src:Z -w /src node:alpine sh
