/*
 * Static file server for the frontend folder.
 *
 * Only files inside FRONTEND_DIR are readable. Directory requests resolve to
 * index.html so every existing URL (/calculators/plate/) keeps working exactly
 * as it did on the static host.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { FRONTEND_DIR } = require("../config");

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".pdf": "application/pdf",
    ".map": "application/json; charset=utf-8"
};

function resolveTarget(pathname) {
    let decoded;

    try {
        decoded = decodeURIComponent(pathname);
    } catch (error) {
        return null;
    }

    if (decoded.indexOf("\0") !== -1) {
        return null;
    }

    const joined = path.join(FRONTEND_DIR, decoded);
    const resolved = path.resolve(joined);

    if (resolved !== FRONTEND_DIR && !resolved.startsWith(FRONTEND_DIR + path.sep)) {
        return null;
    }

    return resolved;
}

function cacheControl(ext) {
    if (ext === ".html") {
        return "no-cache";
    }
    if (ext === ".js" || ext === ".css" || ext === ".webmanifest") {
        return "public, max-age=0, must-revalidate";
    }
    return "public, max-age=86400";
}

function serveStatic(req, res, pathname) {
    let target = resolveTarget(pathname);

    if (!target) {
        return false;
    }

    let stats;

    try {
        stats = fs.statSync(target);
    } catch (error) {
        return false;
    }

    if (stats.isDirectory()) {
        target = path.join(target, "index.html");

        try {
            stats = fs.statSync(target);
        } catch (error) {
            return false;
        }
    }

    if (!stats.isFile()) {
        return false;
    }

    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";

    res.statusCode = 200;
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Cache-Control", cacheControl(ext));
    res.setHeader("Last-Modified", stats.mtime.toUTCString());

    if (req.method === "HEAD") {
        res.end();
        return true;
    }

    res.end(fs.readFileSync(target));
    return true;
}

module.exports = { serveStatic, MIME, FRONTEND_DIR };
