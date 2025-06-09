/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { splitVendorChunkPlugin } from "vite";
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
        rollupOptions: {
            external: [
                "@lichess-org/stockfish-web/sf17-79.js",
                "@lichess-org/stockfish-web/fsf14.js",
                "@lichess-org/stockfish-web/sf16-7.js",
            ],
        },
    },
    server: {
        headers: {
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
        },
    },
    plugins: [
        splitVendorChunkPlugin(),
        viteStaticCopy({
            targets: [
                // {
                //     src: "node_modules/@lichess-org/stockfish-web/sf171-79*",
                //     dest: "assets/stockfish/",
                // },
                {
                    src: "node_modules/@lichess-org/stockfish-web/fsf14*",
                    dest: "assets/stockfish/",
                },
                // {
                //     src: "node_modules/@lichess-org/stockfish-web/sf16-7*",
                //     dest: "assets/stockfish/",
                // },
                {
                    src: "node_modules/chessground/assets/*.css",
                    dest: "assets/chessground/",
                },
            ],
        }),
    ],
    test: {
        environment: "node",
    },
});
