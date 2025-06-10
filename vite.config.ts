/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import csp from "vite-plugin-csp-guard";

export default defineConfig({
    esbuild: {
        supported: {
            "top-level-await": true,
        },
    },
    build: {
        sourcemap: true,
    },
    plugins: [
        csp({
            policy: {
                "default-src": ["'self'"],
                "script-src": ["'self'", "'wasm-unsafe-eval'"],
                "frame-ancestors": ["'none'"],
            },
            build: {
                sri: true,
            },
        }),
    ],
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
