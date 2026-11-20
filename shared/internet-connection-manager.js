/* ==================================================
   INTERNET CONNECTION MANAGER
   Shows the offline message when the connection drops.
   Here is the logic for checking the internet connection.
================================================== */
/*
 * Metal Weight Calculator - global Internet Connection Manager.
 *
 * One shared implementation for every page of the website and for the Android
 * WebView wrapper that loads it.
 *
 * How connectivity is decided (never from navigator.onLine alone):
 *   1. A tiny same-origin request to shared/connection-check.txt proves that
 *      this website's own server is actually reachable.
 *   2. If (and only if) that fails, a few lightweight public endpoints (one of
 *      them by raw IP, so it works without DNS) are asked in parallel.
 *      Reaching one proves the device still has internet, so a failed site
 *      request means "server problem", never "no internet".
 *   3. Only when the site AND the public endpoints are unreachable is the
 *      device treated as offline - and only after repeated verification, so a
 *      slow link or one timed-out request never produces a popup.
 *
 * Resulting states:
 *   online      - everything reachable; no UI at all.
 *   server-down - internet works but this site does not answer: a small,
 *                 non-blocking notice (never the "no internet" dialog).
 *   offline     - no internet at all: modal dialog, page interactions blocked.
 *
 * Android WebView integration (single UI, no duplicates):
 *   The app must NOT show its own connectivity dialog. It forwards its own
 *   state to the page and lets this manager own the UI:
 *     window.dispatchEvent(new CustomEvent('metalweightapp:connectivity',
 *                          {detail:{online:false}}));
 *   Optionally expose window.MetalWeightApp.getConnectionState() -> 'online'
 *   | 'offline' | 'unknown'. Native signals only trigger an immediate verified
 *   check; they never decide the result on their own.
 *
 * Include it once per page:
 *   <script src="../shared/internet-connection-manager.js"></script>
 */
(function () {
    "use strict";

    /* Never install twice on the same page. */
    if (window.InternetConnectionManager) {
        return;
    }

    /* ------------------------------------------------------------------ *
     * Configuration
     * ------------------------------------------------------------------ */

    var SCRIPT_URL = (function () {
        var current = document.currentScript;

        if (current && current.src) {
            return current.src;
        }

        var scripts = document.getElementsByTagName("script");

        for (var i = scripts.length - 1; i >= 0; i -= 1) {
            if (
                scripts[i].src &&
                scripts[i].src.indexOf("internet-connection-manager.js") !== -1
            ) {
                return scripts[i].src;
            }
        }

        return "";
    })();

    var PROBE_URL = SCRIPT_URL
        ? new URL("connection-check.txt", SCRIPT_URL).href
        : "connection-check.txt";

    /* Public, cacheless, ~0 byte endpoints used only to tell "site is down"
     * apart from "device has no internet". One success is enough. */
    var EXTERNAL_PROBES = [
        /* IP-based first: works even when DNS itself is broken. */
        "https://1.1.1.1/cdn-cgi/trace",
        "https://cloudflare.com/cdn-cgi/trace",
        "https://www.gstatic.com/generate_204",
        "https://www.google.com/generate_204"
    ];

    var SITE_TIMEOUT_MS = 4000;        /* one same-origin attempt           */
    var QUICK_TIMEOUT_MS = 2500;       /* fast path after an "offline" event */
    var EXTERNAL_TIMEOUT_MS = 4000;    /* public endpoints                  */
    var RETRY_DELAY_MS = 1200;         /* pause before re-probing           */
    var FINAL_CONFIRM_TIMEOUT_MS = 6000; /* last chance before blocking      */
    var FAILURES_BEFORE_OFFLINE = 2;   /* offline rounds (each already retried) */
    var SERVER_ROUNDS_BEFORE_NOTICE = 2; /* never flash a notice on one glitch */

    /* Only http(s) pages can probe their own server. A page opened from disk
     * (file://, content://, app assets) skips the site probe entirely and only
     * checks the internet, so it can never show a bogus "server" notice.
     * The probe must also be same-origin: a cross-origin answer would be
     * blocked by CORS and would look exactly like an outage. */
    var CAN_PROBE_SITE = (function () {
        if (!/^https?:$/i.test(window.location.protocol)) {
            return false;
        }

        try {
            return new URL(PROBE_URL, window.location.href).origin ===
                window.location.origin;
        } catch (error) {
            return false;
        }
    })();
    var POLL_ONLINE_MS = 25000;        /* background heartbeat while online */
    var POLL_OFFLINE_MS = 5000;        /* fast recovery probe while blocked */
    var POLL_SERVER_MS = 9000;
    var VISIBILITY_THROTTLE_MS = 3000;
    var FOCUS_THROTTLE_MS = 15000;
    var MIN_CHECK_GAP_MS = 800;

    var STATUS = {
        UNKNOWN: "unknown",
        ONLINE: "online",
        SERVER_DOWN: "server-down",
        OFFLINE: "offline"
    };

    var state = {
        status: STATUS.UNKNOWN,
        online: true,
        verified: false,
        checking: false,
        dialog: "",           /* "" | "offline" | "server" */
        lastCheckedAt: 0,
        lastCheckStartedAt: 0
    };

    var offlineRounds = 0;      /* consecutive verified "unreachable" rounds  */
    var serverRounds = 0;
    var subscribers = [];
    var overlay = null;         /* offline modal                              */
    var notice = null;          /* server-outage banner                       */
    var retryButton = null;
    var statusText = null;
    var previousFocus = null;
    var pollTimer = null;
    var pendingCheck = null;
    var activeControllers = [];

// ==================================================
// FUNCTION: ABORT REQUESTS START
// This function performs the abort requests step of this calculator.
// This is where this function's work happens.
// ==================================================
    function abortRequests() {
        var controllers = activeControllers;
        activeControllers = [];

        for (var i = 0; i < controllers.length; i += 1) {
            try {
                controllers[i].abort();
            } catch (error) {
                /* ignore abort errors */
            }
        }
    }
// ==================================================
// FUNCTION: ABORT REQUESTS END
// This function ends here.
// ==================================================
    var listeners = [];
    var disposed = false;
    var paused = false;
    var generation = 0;

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: INJECT STYLES START
// This function performs the inject styles step of this calculator.
// This is where this function's work happens.
// ==================================================
    function injectStyles() {
        if (document.getElementById("icm-styles")) {
            return;
        }

        var style = document.createElement("style");
        style.id = "icm-styles";
        style.textContent = [
            /* --- offline modal --- */
            ".icm-overlay{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(8,24,28,.66);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}",
            ".icm-overlay.icm-visible{display:flex;}",
            ".icm-overlay[hidden]{display:none !important;}",
            "html.icm-offline,html.icm-offline body{overflow:hidden !important;}",
            ".icm-dialog{width:100%;max-width:430px;margin:0;padding:30px 28px 24px;border:1px solid #e0e8e9;border-radius:16px;background:#ffffff;box-shadow:0 24px 64px rgba(4,20,24,.38);font-family:Arial,Helvetica,sans-serif;color:#182b32;text-align:center;-webkit-animation:icm-pop .18s ease-out;animation:icm-pop .18s ease-out;}",
            ".icm-icon{display:flex;align-items:center;justify-content:center;width:58px;height:58px;margin:0 auto 16px;border-radius:50%;background:#eaf7f6;color:#087f7b;}",
            ".icm-icon svg{display:block;width:30px;height:30px;}",
            ".icm-title{margin:0 0 10px;font-size:21px;line-height:1.3;font-weight:800;color:#182b32;letter-spacing:-.2px;}",
            ".icm-message{margin:0 auto;max-width:340px;font-size:14px;line-height:1.6;color:#5c6f77;}",
            ".icm-hint{margin:8px auto 0;max-width:340px;font-size:12.5px;line-height:1.5;color:#8497a0;}",
            ".icm-retry{display:block;width:100%;margin:22px 0 0;padding:13px 18px;border:0;border-radius:10px;background:#087f7b;color:#ffffff;font-family:inherit;font-size:15px;font-weight:700;line-height:1.2;cursor:pointer;-webkit-appearance:none;appearance:none;transition:background .15s ease,box-shadow .15s ease;}",
            ".icm-retry:hover{background:#05635f;}",
            ".icm-retry:focus-visible{outline:3px solid rgba(8,127,123,.35);outline-offset:2px;}",
            ".icm-retry[disabled]{opacity:.7;cursor:default;}",
            ".icm-status{min-height:0;margin:12px 0 0;font-size:12.5px;line-height:1.5;font-weight:600;color:#718087;}",
            ".icm-status:empty{display:none;}",
            "@-webkit-keyframes icm-pop{from{opacity:0;-webkit-transform:translateY(8px) scale(.98);}to{opacity:1;-webkit-transform:none;}}",
            "@keyframes icm-pop{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}",
            "@media (max-width:520px){.icm-dialog{padding:26px 20px 20px;border-radius:14px;}.icm-icon{width:52px;height:52px;margin-bottom:14px;}.icm-title{font-size:19px;}.icm-message{font-size:13.5px;}}",
            "@media (prefers-reduced-motion:reduce){.icm-dialog{-webkit-animation:none;animation:none;}}",
            /* --- server outage banner (non-blocking) --- */
            ".icm-notice{position:fixed;left:50%;top:12px;z-index:2147482999;display:none;align-items:center;gap:10px;max-width:calc(100% - 24px);margin:0;padding:10px 12px 10px 14px;border:1px solid #f0d9a8;border-radius:12px;background:#fff8e8;box-shadow:0 10px 30px rgba(4,20,24,.16);font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;font-weight:600;color:#7a5a10;-webkit-transform:translateX(-50%);transform:translateX(-50%);}",
            ".icm-notice.icm-visible{display:flex;}",
            ".icm-notice[hidden]{display:none !important;}",
            ".icm-notice-text{min-width:0;}",
            ".icm-notice-btn{flex:0 0 auto;padding:7px 12px;border:1px solid #e6c98c;border-radius:8px;background:#ffffff;font-family:inherit;font-size:12.5px;font-weight:700;color:#7a5a10;cursor:pointer;}",
            ".icm-notice-btn:hover{background:#fff1d6;}"
        ].join("");

        (document.head || document.documentElement).appendChild(style);
    }
// ==================================================
// FUNCTION: INJECT STYLES END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Offline modal
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: BUILD OVERLAY START
// This function performs the build overlay step of this calculator.
// This is where this function's work happens.
// ==================================================
    function buildOverlay() {
        if (overlay) {
            return overlay;
        }

        var host = document.createElement("div");
        host.className = "icm-overlay";
        host.id = "internetConnectionOverlay";
        host.hidden = true;
        host.setAttribute("role", "alertdialog");
        host.setAttribute("aria-modal", "true");
        host.setAttribute("aria-labelledby", "icm-title");
        host.setAttribute("aria-describedby", "icm-message");

        host.innerHTML =
            '<div class="icm-dialog" role="document">' +
                '<div class="icm-icon" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M2.5 8.5a15 15 0 0 1 8-3.4"></path>' +
                        '<path d="M13.5 5.1a15 15 0 0 1 8 3.4"></path>' +
                        '<path d="M5.8 12.1a10.5 10.5 0 0 1 5.2-2.2"></path>' +
                        '<path d="M13 9.9a10.5 10.5 0 0 1 5.2 2.2"></path>' +
                        '<path d="M9 15.4a6 6 0 0 1 6 0"></path>' +
                        '<circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none"></circle>' +
                        '<path d="M3 3l18 18"></path>' +
                    "</svg>" +
                "</div>" +
                '<h2 class="icm-title" id="icm-title">No Internet Connection</h2>' +
                '<p class="icm-message" id="icm-message">Your internet connection is lost. Please turn on your internet connection.</p>' +
                '<p class="icm-hint" id="icm-hint">An active internet connection is required to use this website.</p>' +
                '<button type="button" class="icm-retry" id="icmRetry">Retry</button>' +
                '<p class="icm-status" id="icmStatus" role="status" aria-live="polite"></p>' +
            "</div>";

        document.body.appendChild(host);

        overlay = host;
        retryButton = host.querySelector("#icmRetry");
        statusText = host.querySelector("#icmStatus");

        retryButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            retryFromUI();
        });

        return overlay;
    }
// ==================================================
// FUNCTION: BUILD OVERLAY END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Server outage notice (never blocks the page)
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: BUILD NOTICE START
// This function performs the build notice step of this calculator.
// This is where this function's work happens.
// ==================================================
    function buildNotice() {
        if (notice) {
            return notice;
        }

        var bar = document.createElement("div");
        bar.className = "icm-notice";
        bar.id = "icmServerNotice";
        bar.hidden = true;
        bar.setAttribute("role", "status");
        bar.setAttribute("aria-live", "polite");
        bar.innerHTML =
            '<span class="icm-notice-text">Our server is not responding right now. Your internet connection is fine - retrying\u2026</span>' +
            '<button type="button" class="icm-notice-btn" id="icmNoticeRetry">Retry</button>';

        document.body.appendChild(bar);
        notice = bar;

        bar.querySelector("#icmNoticeRetry").addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            runCheck(true);
        });

        return notice;
    }
// ==================================================
// FUNCTION: BUILD NOTICE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SHOW NOTICE START
// This function performs the show notice step of this calculator.
// This is where this function's work happens.
// ==================================================
    function showNotice() {
        injectStyles();
        buildNotice();

        if (notice.hidden) {
            notice.hidden = false;
            notice.classList.add("icm-visible");
        }
    }
// ==================================================
// FUNCTION: SHOW NOTICE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HIDE NOTICE START
// This function performs the hide notice step of this calculator.
// This is where this function's work happens.
// ==================================================
    function hideNotice() {
        if (notice && !notice.hidden) {
            notice.classList.remove("icm-visible");
            notice.hidden = true;
        }
    }
// ==================================================
// FUNCTION: HIDE NOTICE END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Page blocking
     * ------------------------------------------------------------------ */

    /*
     * Only the elements this manager made inert are released again: the page's
     * own components (for example the closed history drawer) may legitimately
     * set "inert" themselves and must keep it.
     */
    var inertedElements = [];

// ==================================================
// FUNCTION: SET PAGE INERT START
// This function performs the set page inert step of this calculator.
// This is where this function's work happens.
// ==================================================
    function setPageInert(blocked) {
        var i;

        if (!blocked) {
            for (i = 0; i < inertedElements.length; i += 1) {
                if (!inertedElements[i].hadInert) {
                    inertedElements[i].element.removeAttribute("inert");
                }
            }

            inertedElements = [];
            return;
        }

        if (inertedElements.length) {
            return;
        }

        var children = document.body ? document.body.children : [];

        for (i = 0; i < children.length; i += 1) {
            var element = children[i];

            if (element === overlay || element === notice || element.tagName === "SCRIPT") {
                continue;
            }

            inertedElements.push({
                element: element,
                hadInert: element.hasAttribute("inert")
            });

            element.setAttribute("inert", "");
        }
    }
// ==================================================
// FUNCTION: SET PAGE INERT END
// This function ends here.
// ==================================================

    /*
     * Interaction guard: even if a widget is added to the page while offline,
     * pointer, keyboard and form events never reach it.
     */
// ==================================================
// FUNCTION: BLOCK INTERACTION START
// This function performs the block interaction step of this calculator.
// This is where this function's work happens.
// ==================================================
    function blockInteraction(event) {
        if (!state.dialog || state.dialog !== "offline") {
            return;
        }

        if (overlay && overlay.contains(event.target)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
        }
    }
// ==================================================
// FUNCTION: BLOCK INTERACTION END
// This function ends here.
// ==================================================

    var BLOCKED_EVENTS = [
        "pointerdown",
        "mousedown",
        "touchstart",
        "click",
        "keydown",
        "keyup",
        "submit"
    ];

    /*
     * Registered through on() from start(), so dispose() removes them again.
     * Leaving capture listeners behind after dispose would keep blocking a
     * page that no longer has a manager.
     */
// ==================================================
// FUNCTION: INSTALL INTERACTION GUARD START
// This function performs the install interaction guard step of this calculator.
// This is where this function's work happens.
// ==================================================
    function installInteractionGuard() {
        for (var b = 0; b < BLOCKED_EVENTS.length; b += 1) {
            on(document, BLOCKED_EVENTS[b], blockInteraction, true);
        }
    }
// ==================================================
// FUNCTION: INSTALL INTERACTION GUARD END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * State notification
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: SNAPSHOT START
// This function performs the snapshot step of this calculator.
// This is where this function's work happens.
// ==================================================
    function snapshot() {
        return {
            status: state.status,
            online: state.online,
            verified: state.verified,
            checking: state.checking,
            dialog: state.dialog,
            lastCheckedAt: state.lastCheckedAt
        };
    }
// ==================================================
// FUNCTION: SNAPSHOT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SET STATE START
// This function performs the set state step of this calculator.
// This is where this function's work happens.
// ==================================================
    function setState(patch) {
        for (var key in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, key)) {
                state[key] = patch[key];
            }
        }

        var detail = snapshot();

        for (var i = 0; i < subscribers.length; i += 1) {
            try {
                subscribers[i](detail);
            } catch (error) {
                /* a subscriber must never break the manager */
            }
        }

        if (typeof CustomEvent === "function") {
            try {
                document.dispatchEvent(
                    new CustomEvent("internetconnectionchange", { detail: detail })
                );
            } catch (error) {
                /* ignore dispatch failures */
            }
        }

        notifyNative(detail);
    }
// ==================================================
// FUNCTION: SET STATE END
// This function ends here.
// ==================================================

    /*
     * Optional one-way report to the Android shell, so the app can update its
     * own loading/error chrome without showing a second offline dialog.
     */
// ==================================================
// FUNCTION: NOTIFY NATIVE START
// This function performs the notify native step of this calculator.
// This is where this function's work happens.
// ==================================================
    function notifyNative(detail) {
        var bridge = window.MetalWeightApp;

        if (!bridge || typeof bridge.onConnectionStateChange !== "function") {
            return;
        }

        try {
            bridge.onConnectionStateChange(
                JSON.stringify({
                    status: detail.status,
                    online: detail.online,
                    dialog: detail.dialog
                })
            );
        } catch (error) {
            /* the bridge is advisory only - never break the page */
        }
    }
// ==================================================
// FUNCTION: NOTIFY NATIVE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: READ NATIVE STATE START
// This function performs the read native state step of this calculator.
// This is where this function's work happens.
// ==================================================
    function readNativeState() {
        var bridge = window.MetalWeightApp;

        if (!bridge || typeof bridge.getConnectionState !== "function") {
            return "unknown";
        }

        try {
            var value = String(bridge.getConnectionState() || "");

            if (value === "online" || value === "offline") {
                return value;
            }
        } catch (error) {
            /* ignore a broken bridge */
        }

        return "unknown";
    }
// ==================================================
// FUNCTION: READ NATIVE STATE END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Dialog control (exactly one dialog, ever)
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: SHOW OFFLINE DIALOG START
// This function performs the show offline dialog step of this calculator.
// This is where this function's work happens.
// ==================================================
    function showOfflineDialog() {
        injectStyles();
        buildOverlay();

        if (state.dialog === "offline" && !overlay.hidden) {
            schedulePoll();
            return;
        }

        hideNotice();

        previousFocus = document.activeElement;
        state.dialog = "offline";

        document.documentElement.classList.add("icm-offline");
        overlay.hidden = false;
        overlay.classList.add("icm-visible");

        if (statusText) {
            statusText.textContent = "";
        }

        if (retryButton) {
            retryButton.disabled = false;
        }

        setPageInert(true);

        window.setTimeout(function () {
            if (retryButton && state.dialog === "offline") {
                try {
                    retryButton.focus();
                } catch (error) {
                    /* ignore focus errors */
                }
            }
        }, 30);

        schedulePoll();
    }
// ==================================================
// FUNCTION: SHOW OFFLINE DIALOG END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HIDE OFFLINE DIALOG START
// This function performs the hide offline dialog step of this calculator.
// This is where this function's work happens.
// ==================================================
    function hideOfflineDialog() {
        if (state.dialog !== "offline") {
            return;
        }

        state.dialog = "";

        document.documentElement.classList.remove("icm-offline");

        if (overlay) {
            overlay.classList.remove("icm-visible");
            overlay.hidden = true;
        }

        if (statusText) {
            statusText.textContent = "";
        }

        if (retryButton) {
            retryButton.disabled = false;
        }

        setPageInert(false);

        if (
            previousFocus &&
            previousFocus !== document.body &&
            typeof previousFocus.focus === "function"
        ) {
            try {
                previousFocus.focus();
            } catch (error) {
                /* ignore focus errors */
            }
        }

        previousFocus = null;
    }
// ==================================================
// FUNCTION: HIDE OFFLINE DIALOG END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Probes
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: FETCH WITH TIMEOUT START
// This function performs the fetch with timeout step of this calculator.
// This is where this function's work happens.
// ==================================================
    function fetchWithTimeout(url, options, timeoutMs) {
        return new Promise(function (resolve) {
            var settled = false;
            var controller =
                typeof AbortController === "function" ? new AbortController() : null;
            var opts = {};
            var key;

            for (key in options) {
                if (Object.prototype.hasOwnProperty.call(options, key)) {
                    opts[key] = options[key];
                }
            }

            if (controller) {
                opts.signal = controller.signal;
                activeControllers.push(controller);
            }

            function finish(result) {
                if (settled) {
                    return;
                }

                settled = true;
                window.clearTimeout(timer);

                if (controller) {
                    var index = activeControllers.indexOf(controller);

                    if (index !== -1) {
                        activeControllers.splice(index, 1);
                    }
                }

                resolve(result);
            }

            var timer = window.setTimeout(function () {
                if (controller) {
                    try {
                        controller.abort();
                    } catch (error) {
                        /* ignore abort errors */
                    }
                }

                finish(null);
            }, timeoutMs);

            var request;

            try {
                request = fetch(url, opts);
            } catch (error) {
                finish(null);
                return;
            }

            request.then(
                function (response) {
                    finish(response || null);
                },
                function () {
                    finish(null);
                }
            );
        });
    }
// ==================================================
// FUNCTION: FETCH WITH TIMEOUT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CACHELESS START
// This function performs the cacheless step of this calculator.
// This is where this function's work happens.
// ==================================================
    function cacheless(url) {
        return url + (url.indexOf("?") === -1 ? "?" : "&") + "icm=" + Date.now();
    }
// ==================================================
// FUNCTION: CACHELESS END
// This function ends here.
// ==================================================

    /* Reachability of this website's own server. Any HTTP answer (even a 404
     * or 500) proves the network path works, so it is never "offline". */
// ==================================================
// FUNCTION: PROBE SITE START
// This function performs the probe site step of this calculator.
// This is where this function's work happens.
// ==================================================
    function probeSite(timeoutMs) {
        return fetchWithTimeout(cacheless(PROBE_URL), { method: "GET", cache: "no-store" }, timeoutMs)
            .then(function (response) {
                return !!response;
            });
    }
// ==================================================
// FUNCTION: PROBE SITE END
// This function ends here.
// ==================================================

    /* Reachability of the wider internet. Only used after probeSite() failed. */
// ==================================================
// FUNCTION: PROBE INTERNET START
// This function performs the probe internet step of this calculator.
// This is where this function's work happens.
// ==================================================
    function probeInternet(timeoutMs) {
        return new Promise(function (resolve) {
            var settled = false;
            var failures = 0;

            function done(ok) {
                if (settled) {
                    return;
                }

                settled = true;
                resolve(ok);
            }

            for (var i = 0; i < EXTERNAL_PROBES.length; i += 1) {
                (function (url) {
                    fetchWithTimeout(
                        url,
                        { method: "GET", mode: "no-cors", cache: "no-store", credentials: "omit" },
                        timeoutMs
                    ).then(function (response) {
                        if (response) {
                            done(true);
                            return;
                        }

                        failures += 1;

                        if (failures >= EXTERNAL_PROBES.length) {
                            done(false);
                        }
                    });
                })(EXTERNAL_PROBES[i]);
            }
        });
    }
// ==================================================
// FUNCTION: PROBE INTERNET END
// This function ends here.
// ==================================================

    /*
     * One verification round: site probe, one short retry, then (only if the
     * site really failed) a public-internet probe to separate "server down"
     * from "no internet".
     */
// ==================================================
// FUNCTION: CLASSIFY START
// This function performs the classify step of this calculator.
// This is where this function's work happens.
// ==================================================
    function classify(timeoutMs) {
        if (!CAN_PROBE_SITE) {
            return probeInternet(EXTERNAL_TIMEOUT_MS).then(function (internetOk) {
                return internetOk ? STATUS.ONLINE : STATUS.OFFLINE;
            });
        }

        return probeSite(timeoutMs).then(function (siteOk) {
            if (siteOk) {
                return STATUS.ONLINE;
            }

            return new Promise(function (resolve) {
                window.setTimeout(resolve, RETRY_DELAY_MS);
            }).then(function () {
                return probeSite(timeoutMs);
            }).then(function (siteOkAgain) {
                if (siteOkAgain) {
                    return STATUS.ONLINE;
                }

                return probeInternet(EXTERNAL_TIMEOUT_MS).then(function (internetOk) {
                    if (!internetOk) {
                        return STATUS.OFFLINE;
                    }

                    /* The internet answers, so the server is the suspect - but
                     * give the site one slower attempt before blaming it: a
                     * momentarily overloaded connection is not an outage. */
                    return probeSite(FINAL_CONFIRM_TIMEOUT_MS).then(function (lateOk) {
                        return lateOk ? STATUS.ONLINE : STATUS.SERVER_DOWN;
                    });
                });
            });
        });
    }
// ==================================================
// FUNCTION: CLASSIFY END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Decision logic
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: APPLY ONLINE START
// This function performs the apply online step of this calculator.
// This is where this function's work happens.
// ==================================================
    function applyOnline() {
        offlineRounds = 0;
        serverRounds = 0;

        hideOfflineDialog();
        hideNotice();

        setState({
            status: STATUS.ONLINE,
            online: true,
            verified: true,
            checking: false,
            dialog: state.dialog,
            lastCheckedAt: Date.now()
        });

        schedulePoll();
    }
// ==================================================
// FUNCTION: APPLY ONLINE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: APPLY SERVER DOWN START
// This function performs the apply server down step of this calculator.
// This is where this function's work happens.
// ==================================================
    function applyServerDown() {
        offlineRounds = 0;
        serverRounds += 1;

        hideOfflineDialog();

        /* Two consecutive rounds before saying anything at all. */
        if (serverRounds >= SERVER_ROUNDS_BEFORE_NOTICE) {
            showNotice();
        }

        setState({
            status: STATUS.SERVER_DOWN,
            online: true,           /* the device does have internet */
            verified: true,
            checking: false,
            dialog: state.dialog,
            lastCheckedAt: Date.now()
        });

        schedulePoll();
    }
// ==================================================
// FUNCTION: APPLY SERVER DOWN END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: APPLY OFFLINE START
// This function performs the apply offline step of this calculator.
// This is where this function's work happens.
// ==================================================
    function applyOffline(force) {
        serverRounds = 0;
        offlineRounds += 1;

        if (!force && offlineRounds < FAILURES_BEFORE_OFFLINE) {
            /* One bad round is not proof: stay online and re-verify soon. */
            setState({
                status: STATUS.ONLINE,
                online: true,
                verified: false,
                checking: false,
                dialog: state.dialog,
                lastCheckedAt: Date.now()
            });

            schedulePoll(Math.min(POLL_OFFLINE_MS, 3000));
            return;
        }

        hideNotice();
        showOfflineDialog();

        setState({
            status: STATUS.OFFLINE,
            online: false,
            verified: true,
            checking: false,
            dialog: "offline",
            lastCheckedAt: Date.now()
        });

        schedulePoll();
    }
// ==================================================
// FUNCTION: APPLY OFFLINE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RUN CHECK START
// This function performs the run check step of this calculator.
// This is where this function's work happens.
// ==================================================
    function runCheck(force) {
        if (disposed || paused) {
            return Promise.resolve(state.status);
        }

        var gen = generation;

        if (pendingCheck) {
            if (!force) {
                return pendingCheck;
            }

            /* A forced check waits for the running one instead of racing it. */
            return pendingCheck.then(function (status) {
                if (status === STATUS.ONLINE) {
                    return status;
                }

                return runCheck(true);
            });
        }

        var now = Date.now();

        if (!force && state.lastCheckStartedAt && now - state.lastCheckStartedAt < MIN_CHECK_GAP_MS) {
            return Promise.resolve(state.status);
        }

        state.lastCheckStartedAt = now;

        if (!state.checking) {
            setState({ checking: true });
        }

        pendingCheck = classify(
            navigator.onLine === false ? QUICK_TIMEOUT_MS : SITE_TIMEOUT_MS
        )
            .then(function (status) {
                if (disposed || gen !== generation) {
                    return status;
                }

                var browserOffline = navigator.onLine === false;

                if (status === STATUS.ONLINE) {
                    applyOnline();
                    return status;
                }

                if (status === STATUS.SERVER_DOWN) {
                    applyServerDown();
                    return status;
                }

                /* Both the site and the public internet are unreachable.
                 * Before declaring anything, give the site one last, longer
                 * chance: on a slow link the earlier attempts may simply have
                 * timed out, and a false "no internet" block is far worse
                 * than a few extra seconds of waiting. */
                if (!CAN_PROBE_SITE) {
                    /* No same-origin probe exists (file://, app asset or a
                     * cross-origin script), so the internet probe is the only
                     * signal - do not spend a request on a probe that can
                     * only fail. */
                    applyOffline(browserOffline || !!force);
                    return status;
                }

                return probeSite(FINAL_CONFIRM_TIMEOUT_MS).then(function (lateOk) {
                    if (disposed || gen !== generation) {
                        return status;
                    }

                    if (lateOk) {
                        applyOnline();
                        return STATUS.ONLINE;
                    }

                    /* When the platform itself reports "offline" a single
                     * verified round is enough; otherwise ask for a second. */
                    applyOffline(browserOffline || !!force);
                    return status;
                });
            })
            .then(
                function (status) {
                    if (gen === generation) {
                        pendingCheck = null;
                    }

                    return status;
                },
                function () {
                    /* The manager must never leave the page blocked because of
                     * an internal error - fail open (treat as online). */
                    if (gen === generation) {
                        pendingCheck = null;
                        applyOnline();
                    }

                    return state.status;
                }
            );

        return pendingCheck;
    }
// ==================================================
// FUNCTION: RUN CHECK END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Retry button
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: RETRY FROM U I START
// This function performs the retry from u i step of this calculator.
// This is where this function's work happens.
// ==================================================
    function retryFromUI() {
        if (state.checking) {
            return;
        }

        if (retryButton) {
            retryButton.disabled = true;
        }

        if (statusText) {
            statusText.textContent = "Checking connection\u2026";
        }

        offlineRounds = FAILURES_BEFORE_OFFLINE - 1;

        runCheck(true).then(function (status) {
            if (retryButton) {
                retryButton.disabled = false;
            }

            if (status !== STATUS.ONLINE && statusText && state.dialog === "offline") {
                statusText.textContent =
                    "Still offline. Turn on your internet connection and try again.";
            }
        });
    }
// ==================================================
// FUNCTION: RETRY FROM U I END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Background polling
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: SCHEDULE POLL START
// This function performs the schedule poll step of this calculator.
// This is where this function's work happens.
// ==================================================
    function schedulePoll(delay) {
        window.clearTimeout(pollTimer);
        pollTimer = null;

        if (disposed || paused) {
            return;
        }

        if (document.visibilityState === "hidden") {
            /* No point probing a background tab: the visibility handler
             * rechecks as soon as the page is shown again. */
            return;
        }

        var wait = delay;

        if (!wait) {
            if (state.status === STATUS.OFFLINE) {
                wait = POLL_OFFLINE_MS;
            } else if (state.status === STATUS.SERVER_DOWN) {
                wait = POLL_SERVER_MS;
            } else {
                wait = POLL_ONLINE_MS;
            }
        }

        pollTimer = window.setTimeout(function () {
            pollTimer = null;
            runCheck(false);
        }, wait);
    }
// ==================================================
// FUNCTION: SCHEDULE POLL END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Browser / native events
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: ON START
// This function performs the on step of this calculator.
// This is where this function's work happens.
// ==================================================
    function on(target, type, handler, options) {
        target.addEventListener(type, handler, options || false);
        listeners.push([target, type, handler, options || false]);
    }
// ==================================================
// FUNCTION: ON END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HANDLE BROWSER OFFLINE START
// This function performs the handle browser offline step of this calculator.
// This is where this function's work happens.
// ==================================================
    function handleBrowserOffline() {
        /* Verify before declaring anything: a wrong "offline" event must never
         * block a working site. */
        window.clearTimeout(pollTimer);
        pollTimer = null;
        runCheck(true);
    }
// ==================================================
// FUNCTION: HANDLE BROWSER OFFLINE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HANDLE BROWSER ONLINE START
// This function performs the handle browser online step of this calculator.
// This is where this function's work happens.
// ==================================================
    function handleBrowserOnline() {
        /* Reconnected: verify right away so the dialog disappears promptly.
         * The check itself still needs several failures before blocking. */
        offlineRounds = 0;
        runCheck(true);
    }
// ==================================================
// FUNCTION: HANDLE BROWSER ONLINE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HANDLE VISIBILITY START
// This function performs the handle visibility step of this calculator.
// This is where this function's work happens.
// ==================================================
    function handleVisibility() {
        if (document.visibilityState !== "visible") {
            window.clearTimeout(pollTimer);
            pollTimer = null;
            return;
        }

        resume();

        if (Date.now() - state.lastCheckedAt < VISIBILITY_THROTTLE_MS) {
            return;
        }

        /* Backgrounded WebViews can suspend timers: recheck on return. */
        runCheck(false);
    }
// ==================================================
// FUNCTION: HANDLE VISIBILITY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HANDLE FOCUS START
// This function performs the handle focus step of this calculator.
// This is where this function's work happens.
// ==================================================
    function handleFocus() {
        if (Date.now() - state.lastCheckedAt < FOCUS_THROTTLE_MS) {
            return;
        }

        runCheck(false);
    }
// ==================================================
// FUNCTION: HANDLE FOCUS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HANDLE PAGE SHOW START
// This function performs the handle page show step of this calculator.
// This is where this function's work happens.
// ==================================================
    function handlePageShow(event) {
        if (event && event.persisted) {
            resume();
            runCheck(true);
        }
    }
// ==================================================
// FUNCTION: HANDLE PAGE SHOW END
// This function ends here.
// ==================================================

    /* Native WebView signals: they only trigger a verified check. */
// ==================================================
// FUNCTION: HANDLE NATIVE SIGNAL START
// This function performs the handle native signal step of this calculator.
// This is where this function's work happens.
// ==================================================
    function handleNativeSignal() {
        runCheck(false);
    }
// ==================================================
// FUNCTION: HANDLE NATIVE SIGNAL END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Cleanup
     * ------------------------------------------------------------------ */

    /*
     * Backgrounded WebViews (and bfcache) suspend timers and may hold stale
     * requests. Pausing aborts everything in flight; resuming starts a fresh,
     * generation-tagged check so late results can never overwrite it.
     */
// ==================================================
// FUNCTION: PAUSE START
// This function performs the pause step of this calculator.
// This is where this function's work happens.
// ==================================================
    function pause() {
        paused = true;
        generation += 1;
        pendingCheck = null;
        window.clearTimeout(pollTimer);
        pollTimer = null;
        abortRequests();
    }
// ==================================================
// FUNCTION: PAUSE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RESUME START
// This function performs the resume step of this calculator.
// This is where this function's work happens.
// ==================================================
    function resume() {
        if (disposed || !paused) {
            return;
        }

        paused = false;

        if (Date.now() - state.lastCheckedAt >= VISIBILITY_THROTTLE_MS) {
            runCheck(false);
        } else {
            schedulePoll();
        }
    }
// ==================================================
// FUNCTION: RESUME END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: DISPOSE START
// This function performs the dispose step of this calculator.
// This is where this function's work happens.
// ==================================================
    function dispose() {
        disposed = true;
        generation += 1;
        window.clearTimeout(pollTimer);
        abortRequests();

        for (var i = 0; i < listeners.length; i += 1) {
            var entry = listeners[i];

            try {
                entry[0].removeEventListener(entry[1], entry[2], entry[3]);
            } catch (error) {
                /* ignore removal errors */
            }
        }

        listeners = [];

        /* A disposed manager must never leave the page blocked (inert +
         * scroll lock) or a dialog on screen. */
        hideOfflineDialog();
        hideNotice();
    }
// ==================================================
// FUNCTION: DISPOSE END
// This function ends here.
// ==================================================

    /* ------------------------------------------------------------------ *
     * Public API
     * ------------------------------------------------------------------ */

    window.InternetConnectionManager = {
        STATUS: STATUS,
        isOnline: function () {
            return state.online;
        },
        getState: snapshot,
        check: function () {
            return runCheck(false).then(snapshot);
        },
        retry: function () {
            return runCheck(true).then(snapshot);
        },
        notifyNativeState: function (online) {
            /* Native says "offline" - verify now instead of waiting for the
             * next timer; native "online" gets the same treatment. */
            if (typeof online === "boolean" && Date.now() - state.lastCheckedAt < 1500) {
                return Promise.resolve(snapshot());
            }

            return runCheck(false).then(snapshot);
        },
        subscribe: function (callback) {
            if (typeof callback !== "function") {
                return function () {};
            }

            subscribers.push(callback);

            return function () {
                var index = subscribers.indexOf(callback);

                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
            };
        },
        dispose: dispose
    };

    /* ------------------------------------------------------------------ *
     * Start
     * ------------------------------------------------------------------ */

// ==================================================
// FUNCTION: START START
// This function performs the start step of this calculator.
// This is where this function's work happens.
// ==================================================
    function start() {
        if (disposed) {
            return;
        }

        injectStyles();
        buildOverlay();
        buildNotice();
        installInteractionGuard();

        on(window, "offline", handleBrowserOffline);
        on(window, "online", handleBrowserOnline);
        on(document, "visibilitychange", handleVisibility);
        on(window, "focus", handleFocus);
        on(window, "pageshow", handlePageShow);
        on(window, "pagehide", pause);
        on(window, "metalweightapp:connectivity", handleNativeSignal);
        on(document, "metalweightapp:connectivity", handleNativeSignal);

        /* A cached page restored inside a WebView still gets verified - the
         * page is blocked if the connection is genuinely gone. Native state
         * only decides when to ask, never the answer itself. */
        if (readNativeState() === "offline") {
            /* Native thinks the device lost its connection: verify right away,
             * but let the probe result decide (Wi-Fi can be associated with no
             * internet, and a stale native flag must never block a working page). */
            runCheck(true);
        } else {
            runCheck(false);
        }
    }
// ==================================================
// FUNCTION: START END
// This function ends here.
// ==================================================

    if (document.body) {
        start();
    } else {
        document.addEventListener("DOMContentLoaded", start);
    }
})();

/* ==================================================
   INTERNET CONNECTION MANAGER END
   This JavaScript file ends here.
================================================== */