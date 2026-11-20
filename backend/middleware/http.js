/*
 * Small HTTP helpers shared by the API routes.
 */
"use strict";

const MAX_BODY_BYTES = require("../config").MAX_BODY_BYTES;

function securityHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);

    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(body));
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
}

function sendText(res, status, body, type) {
    res.statusCode = status;
    res.setHeader("Content-Type", (type || "text/plain") + "; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(body));
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];

        req.on("data", (chunk) => {
            size += chunk.length;

            if (size > MAX_BODY_BYTES) {
                const error = new Error("Request body is too large.");
                error.status = 413;
                reject(error);
                req.destroy();
                return;
            }

            chunks.push(chunk);
        });

        req.on("end", () => {
            if (!chunks.length) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch (error) {
                const invalid = new Error("Request body must be valid JSON.");
                invalid.status = 400;
                reject(invalid);
            }
        });

        req.on("error", reject);
    });
}

function clientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];

    if (typeof forwarded === "string" && forwarded.length) {
        return forwarded.split(",")[0].trim();
    }

    return req.socket.remoteAddress || "unknown";
}

module.exports = {
    securityHeaders,
    sendJson,
    sendText,
    readBody,
    clientIp
};
