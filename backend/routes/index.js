/*
 * API router.
 *
 *   GET  /api/health              service check
 *   GET  /api/calculators         calculator slugs the API serves
 *   GET  /api/materials           density tables as JSON
 *   GET  /api/bootstrap.js        density tables + API base for the pages
 *   POST /api/calculate/:slug     run one calculation
 */
"use strict";

const { API_KEY } = require("../config");
const { sendJson, sendText, readBody, clientIp } = require("../middleware/http");
const { applyCors } = require("../middleware/cors");
const rateLimit = require("../middleware/rateLimit");
const calculationController = require("../controllers/calculationController");
const materialsController = require("../controllers/materialsController");
const { ValidationError } = require("../core/validation");

function isApi(pathname) {
    return pathname === "/api" || pathname.startsWith("/api/");
}

async function handle(req, res, pathname, search) {
    if (!applyCors(req, res)) {
        sendJson(res, 403, {
            ok: false,
            error: { message: "Origin not allowed." }
        });
        return;
    }

    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (pathname === "/api/health") {
        sendJson(res, 200, {
            ok: true,
            service: "metal-weight-calculator-api",
            calculators: require("../calculations").list().length
        });
        return;
    }

    if (pathname === "/api/bootstrap.js") {
        /* This table is small and changes with the backend; never let a
           browser keep a stale or empty copy from an earlier request. */
        res.setHeader("Cache-Control", "no-store");
        sendText(
            res,
            200,
            materialsController.bootstrapScript(),
            "text/javascript"
        );
        return;
    }

    if (pathname === "/api/materials") {
        sendJson(res, 200, materialsController.materialsJson());
        return;
    }

    if (pathname === "/api/calculators") {
        sendJson(res, 200, calculationController.list());
        return;
    }

    if (pathname.startsWith("/api/calculate/")) {
        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            sendJson(res, 405, {
                ok: false,
                error: { message: "Use POST for calculations." }
            });
            return;
        }

        if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
            sendJson(res, 401, {
                ok: false,
                error: { message: "Unauthorised." }
            });
            return;
        }

        const limit = rateLimit.check(clientIp(req));

        if (!limit.allowed) {
            res.setHeader("Retry-After", String(limit.retryAfter));
            sendJson(res, 429, {
                ok: false,
                error: { message: "Too many calculations. Please wait a moment." }
            });
            return;
        }

        const slug = decodeURIComponent(pathname.slice("/api/calculate/".length));
        const payload = await readBody(req);

        try {
            const body = calculationController.calculate(slug, payload);
            sendJson(res, 200, body);
        } catch (error) {
            if (error instanceof ValidationError) {
                sendJson(res, error.status || 400, {
                    ok: false,
                    error: { message: error.message, field: error.field || null }
                });
                return;
            }

            throw error;
        }

        return;
    }

    sendJson(res, 404, {
        ok: false,
        error: { message: "Unknown API route: " + pathname }
    });
}

module.exports = { isApi, handle };
