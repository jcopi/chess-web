/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
    esbuild: {
        supported: {
            "top-level-await": true,
        },
    },
    build: {
        sourcemap: true,
    },
    server: {
        headers: {
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
        },
    },
    test: {
        environment: "node",
    },
});
