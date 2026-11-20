/*
 * Environment configuration.
 *
 * Every tunable value comes from the environment (or backend/.env), so the
 * same code runs locally and on a host without edits. Nothing secret is ever
 * written to frontend files.
 */
"use strict";

const path = require("path");
const fs = require("fs");

/* Minimal .env reader: KEY=VALUE lines, # comments, no dependencies. */
function loadEnvFile(file) {
    if (!fs.existsSync(file)) {
        return;
    }

    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const eq = trimmed.indexOf("=");

        if (eq === -1) {
            continue;
        }

        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
            process.env[key] = value;
        }
    }
}

loadEnvFile(path.join(__dirname, ".env"));

function intFromEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const PORT = intFromEnv("PORT", 8080);
const HOST = process.env.HOST || "127.0.0.1";

/* Absolute base URL the browser should call, or "" for same origin. */
const PUBLIC_API_BASE = (process.env.PUBLIC_API_BASE || "").replace(/\/+$/, "");

/* Comma separated list; empty means same-origin only (no CORS headers). */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

/* Optional shared key: when set, /api/calculate requires x-api-key. */
const API_KEY = process.env.API_KEY || "";

const RATE_LIMIT_MAX = intFromEnv("RATE_LIMIT_MAX", 120);
const RATE_LIMIT_WINDOW_MS = intFromEnv("RATE_LIMIT_WINDOW_MS", 60000);

const MAX_BODY_BYTES = intFromEnv("MAX_BODY_BYTES", 16384);

const FRONTEND_DIR = path.resolve(
    __dirname,
    process.env.FRONTEND_DIR || path.join("..", "frontend")
);

module.exports = {
    PORT,
    HOST,
    PUBLIC_API_BASE,
    ALLOWED_ORIGINS,
    API_KEY,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
    MAX_BODY_BYTES,
    FRONTEND_DIR,
    NODE_ENV: process.env.NODE_ENV || "development"
};
