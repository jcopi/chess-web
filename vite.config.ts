/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
    esbuild: {
        supported: {
            "top-level-await": true,
        },
    },
    optimizeDeps: {
        exclude: ["@lichess-org/stockfish-web"],
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
    plugins: [
        //splitVendorChunkPlugin(),
        viteStaticCopy({
            targets: [
                {
                    src: "node_modules/@lichess-org/stockfish-web/fsf14*.wasm",
                    dest: "assets/stockfish/",
                },
            ],
        }),
    ],
    test: {
        environment: "node",
    },
});
