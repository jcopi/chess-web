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
                "default-src": ["'none'"],
                "script-src": ["'self'", "'wasm-unsafe-eval'"],
                "style-src": ["'self'"],
                "font-src": ["'self'"],
                "connect-src": ["'self'"],
                "img-src": ["'self'", "data:"],
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
