/*
 * Metal Weight Calculator — backend server.
 *
 * Serves the calculation API and the frontend folder from one origin, so the
 * website keeps working with the paths it always had.
 *
 *   npm start          production-style run
 *   npm run dev        restart on file change
 *
 * Environment (see .env.example): PORT, HOST, FRONTEND_DIR, PUBLIC_API_BASE,
 * ALLOWED_ORIGINS, API_KEY, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS.
 */
"use strict";

const http = require("http");
const fs = require("fs");
const { attach } = require("./app");
const { PORT, HOST, FRONTEND_DIR, NODE_ENV } = require("./config");

function main() {
    if (!fs.existsSync(FRONTEND_DIR)) {
        console.error(
            "[startup] Frontend folder not found: " + FRONTEND_DIR +
            "\n          Set FRONTEND_DIR in backend/.env or start from the backend folder."
        );
        process.exit(1);
    }

    const server = attach(http.createServer());

    server.listen(PORT, HOST, () => {
        const base = "http://" + (HOST === "0.0.0.0" ? "localhost" : HOST) + ":" + PORT;

        console.log("Metal Weight Calculator running (" + NODE_ENV + ")");
        console.log("  site   " + base + "/");
        console.log("  api    " + base + "/api/health");
        console.log("  files  " + FRONTEND_DIR);
    });

    const shutdown = (signal) => {
        console.log("\n[stop] " + signal + " received, closing server");
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 3000).unref();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
