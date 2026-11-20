/*
 * CORS policy.
 *
 * The frontend is normally served from the same origin as the API, so a
 * request whose Origin matches this server's Host is allowed without any CORS
 * headers (browsers send Origin on POST even for same-origin requests).
 * Cross-origin callers must be listed in ALLOWED_ORIGINS; anything else is
 * refused.
 */
"use strict";

const { ALLOWED_ORIGINS, NODE_ENV } = require("../config");

function applyCors(req, res) {
    const origin = req.headers.origin;

    if (!origin) {
        return true;  /* same-origin navigation / server-to-server */
    }

    let allowed = false;

    /* Same origin: the page was served by this very server. */
    if (origin !== "null") {
        try {
            if (new URL(origin).host === req.headers.host) {
                allowed = true;
            }
        } catch (error) {
            /* Not a same-origin request; the checks below still apply. */
        }
    }

    if (!allowed && ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        allowed = true;
    }

    /* Local development convenience: a page opened from disk (origin "null")
       or from another localhost port can call this same local backend. */
    const localDevOrigin = origin === "null" ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

    if (!allowed && NODE_ENV !== "production" && localDevOrigin) {
        allowed = true;
    }

    if (!allowed) {
        return false;
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    res.setHeader("Access-Control-Max-Age", "600");

    return true;
}

module.exports = { applyCors };
