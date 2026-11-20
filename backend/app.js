/*
 * Request handler: the API under /api, everything else from the frontend
 * folder. Nothing outside frontend/ is ever served.
 */
"use strict";

const { securityHeaders, sendJson, sendText } = require("./middleware/http");
const routes = require("./routes");
const { serveStatic } = require("./middleware/static");

async function handler(req, res) {
    securityHeaders(res);

    let url;

    try {
        url = new URL(req.url, "http://localhost");
    } catch (error) {
        sendText(res, 400, "Bad request");
        return;
    }

    const pathname = url.pathname;

    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST" && req.method !== "OPTIONS") {
        res.setHeader("Allow", "GET, HEAD, POST, OPTIONS");
        sendText(res, 405, "Method not allowed");
        return;
    }

    if (routes.isApi(pathname)) {
        await routes.handle(req, res, pathname, url.search);
        return;
    }

    if (req.method === "POST") {
        sendText(res, 405, "Method not allowed");
        return;
    }

    if (serveStatic(req, res, pathname)) {
        return;
    }

    /* A missing page gets the site's 404 page when one exists. */
    if (serveStatic(req, res, "/404.html")) {
        res.statusCode = 404;
        return;
    }

    sendText(res, 404, "Not found");
}

function attach(server) {
    server.on("request", (req, res) => {
        Promise.resolve(handler(req, res)).catch((error) => {
            const status = error && error.status ? error.status : 500;

            if (!res.headersSent) {
                sendJson(res, status, {
                    ok: false,
                    error: {
                        message: status === 500
                            ? "The calculation service hit an unexpected error."
                            : error.message
                    }
                });
            } else {
                res.end();
            }

            if (status >= 500) {
                console.error("[api]", error);
            }
        });
    });

    return server;
}

module.exports = { handler, attach };
