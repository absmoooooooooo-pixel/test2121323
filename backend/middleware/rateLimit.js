/*
 * In-memory sliding-window rate limiter for the calculation API.
 *
 * A single Node process serves the site, so a Map is enough; a multi-instance
 * deployment should move this counter to a shared store.
 */
"use strict";

const { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = require("../config");

const hits = new Map();

function prune(now) {
    for (const [key, entry] of hits) {
        if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
            hits.delete(key);
        }
    }
}

/**
 * @returns {{ allowed: boolean, retryAfter: number }}
 */
function check(key) {
    const now = Date.now();

    if (hits.size > 5000) {
        prune(now);
    }

    const entry = hits.get(key);

    if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
        hits.set(key, { start: now, count: 1 });
        return { allowed: true, retryAfter: 0 };
    }

    entry.count += 1;

    if (entry.count > RATE_LIMIT_MAX) {
        return {
            allowed: false,
            retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.start)) / 1000)
        };
    }

    return { allowed: true, retryAfter: 0 };
}

function reset() {
    hits.clear();
}

module.exports = { check, reset, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS };
