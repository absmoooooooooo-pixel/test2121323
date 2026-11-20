/*
 * Metal Weight Calculator - minimal PWA service worker.
 *
 * This worker deliberately does not cache calculator pages. Calculations and
 * history must always use the current page, so requests are passed through to
 * the network unchanged. The worker exists to provide the standard service
 * worker required by the browser installation flow.
 */
"use strict";

// ==================================================
// BUTTON AND INPUT EVENT LISTENERS START
// These lines connect the buttons and inputs to the functions above.
// Here the click and change events of the buttons and inputs are attached.
// ==================================================
self.addEventListener("install", function (event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(fetch(event.request));
});
// ==================================================
// BUTTON AND INPUT EVENT LISTENERS END
// The part with the events ends here.
// ==================================================
