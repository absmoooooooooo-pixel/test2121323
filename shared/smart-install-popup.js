/* ==================================================
   INSTALL POPUP JAVASCRIPT START
   Decides when to show the install popup.
   Here is the logic for showing the install popup.
================================================== */
/*
 * Smart Website Shortcut / Add to Home Screen Popup
 * Separate reusable feature file. Detects install/app state and shows a
 * one-time, cooldown-aware install prompt across all pages.
 */
(function () {
    "use strict";

    var VERSION = "v1";
    var PREFIX = "jadhav-smart-install:" + VERSION;
    var INSTALLED_KEY = PREFIX + ":installed";
    var DISMISSED_UNTIL_KEY = PREFIX + ":dismissed-until";
    var LAST_SHOWN_KEY = PREFIX + ":last-shown";
    var SHOWN_SESSION_KEY = PREFIX + ":shown-session";

    var DISMISS_DAYS = 30;        // cooldown after "NO / Maybe Later"
    var SHOW_COOLDOWN_DAYS = 14;  // general cooldown between shows
    var INSTALL_SETTLE_DAYS = 1;  // short cooldown after accepted prompt settles
    var SHOW_DELAY = 2200;

    var script = document.currentScript;
    var scriptUrl = script && script.src;
    if (!scriptUrl) {
        var scripts = document.getElementsByTagName("script");
        for (var i = scripts.length - 1; i >= 0; i -= 1) {
            if (/smart-install-popup\.js(?:[?#]|$)/.test(scripts[i].src)) {
                scriptUrl = scripts[i].src;
                break;
            }
        }
    }
    if (!scriptUrl) return;

    var iconUrl;
    var serviceWorkerUrl;
    try {
        iconUrl = new URL("../icons/icon-192.png", scriptUrl).href;
        serviceWorkerUrl = new URL("../service-worker.js", scriptUrl).href;
    } catch (e) {
        return;
    }

    // Do not run inside iframes.
    try {
        if (window.top !== window.self) return;
    } catch (e) {
        return;
    }

    if (!/^https?:$/.test(window.location.protocol)) return;

    var localStore = null;
    var sessionStore = null;
    try { localStore = window.localStorage; } catch (e) { localStore = null; }
    try { sessionStore = window.sessionStorage; } catch (e) { sessionStore = null; }

    var deferredPrompt = null;
    var installFlowPending = false;
    var installedRelated = false;
    var shownThisSession = false;
    var isOpen = false;
    var showTimer = 0;
    var currentMode = "native"; // native | ios | manual
    var lastFocused = null;

    var popup = null;
    var sheet = null;
    var yesButton = null;
    var noButton = null;
    var iosBox = null;
    var manualBox = null;
    var note = null;

// ==================================================
// FUNCTION: READ START
// This function performs the read step of this calculator.
// This is where this function's work happens.
// ==================================================
    function read(storage, key) {
        try { return storage ? storage.getItem(key) : null; } catch (e) { return null; }
    }
// ==================================================
// FUNCTION: READ END
// This function ends here.
// ==================================================
// ==================================================
// FUNCTION: WRITE START
// This function performs the write step of this calculator.
// This is where this function's work happens.
// ==================================================
    function write(storage, key, value) {
        try { if (storage) storage.setItem(key, value); } catch (e) { /* ignore */ }
    }
// ==================================================
// FUNCTION: WRITE END
// This function ends here.
// ==================================================
// ==================================================
// FUNCTION: REMOVE START
// This function performs the remove step of this calculator.
// This is where this function's work happens.
// ==================================================
    function remove(storage, key) {
        try { if (storage) storage.removeItem(key); } catch (e) { /* ignore */ }
    }
// ==================================================
// FUNCTION: REMOVE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HAS INSTALLED FLAG START
// This function performs the has installed flag step of this calculator.
// This is where this function's work happens.
// ==================================================
    function hasInstalledFlag() {
        return read(localStore, INSTALLED_KEY) === "1";
    }
// ==================================================
// FUNCTION: HAS INSTALLED FLAG END
// This function ends here.
// ==================================================
// ==================================================
// FUNCTION: MARK INSTALLED START
// This function performs the mark installed step of this calculator.
// This is where this function's work happens.
// ==================================================
    function markInstalled() {
        write(localStore, INSTALLED_KEY, "1");
        remove(localStore, DISMISSED_UNTIL_KEY);
        remove(localStore, LAST_SHOWN_KEY);
        notifyInstalled();
    }
// ==================================================
// FUNCTION: MARK INSTALLED END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: NOTIFY INSTALLED START
// This function performs the notify installed step of this calculator.
// This is where this function's work happens.
// ==================================================
    function notifyInstalled() {
        try {
            window.dispatchEvent(new CustomEvent("jadhav:installed"));
        } catch (e) {
            try {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent("jadhav:installed", false, false, null);
                window.dispatchEvent(event);
            } catch (e2) { /* optional event API */ }
        }
    }
// ==================================================
// FUNCTION: NOTIFY INSTALLED END
// This function ends here.
// ==================================================
// ==================================================
// FUNCTION: SET COOLDOWN START
// This function performs the set cooldown step of this calculator.
// This is where this function's work happens.
// ==================================================
    function setCooldown(days) {
        write(localStore, DISMISSED_UNTIL_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
    }
// ==================================================
// FUNCTION: SET COOLDOWN END
// This function ends here.
// ==================================================
// ==================================================
// FUNCTION: IS DISMISSED START
// This function performs the is dismissed step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isDismissed() {
        var until = parseInt(read(localStore, DISMISSED_UNTIL_KEY), 10);
        if (!until || isNaN(until)) return false;
        if (Date.now() >= until) {
            remove(localStore, DISMISSED_UNTIL_KEY);
            return false;
        }
        return true;
    }
// ==================================================
// FUNCTION: IS DISMISSED END
// This function ends here.
// ==================================================
// ==================================================
// FUNCTION: WAS SHOWN RECENTLY START
// This function performs the was shown recently step of this calculator.
// This is where this function's work happens.
// ==================================================
    function wasShownRecently() {
        if (shownThisSession) return true;
        if (read(sessionStore, SHOWN_SESSION_KEY) === "1") return true;
        var last = parseInt(read(localStore, LAST_SHOWN_KEY), 10);
        if (!last || isNaN(last)) return false;
        return Date.now() - last < SHOW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    }
// ==================================================
// FUNCTION: WAS SHOWN RECENTLY END
// This function ends here.
// ==================================================
// ==================================================
// FUNCTION: MARK SHOWN START
// This function performs the mark shown step of this calculator.
// This is where this function's work happens.
// ==================================================
    function markShown() {
        shownThisSession = true;
        write(sessionStore, SHOWN_SESSION_KEY, "1");
        write(localStore, LAST_SHOWN_KEY, String(Date.now()));
    }
// ==================================================
// FUNCTION: MARK SHOWN END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS STANDALONE START
// This function performs the is standalone step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isStandalone() {
        var modes = [
            "(display-mode: standalone)",
            "(display-mode: fullscreen)",
            "(display-mode: minimal-ui)",
            "(display-mode: window-controls-overlay)"
        ];
        try {
            for (var i = 0; i < modes.length; i += 1) {
                if (window.matchMedia && window.matchMedia(modes[i]).matches) return true;
            }
        } catch (e) { /* ignore */ }
        return window.navigator.standalone === true; // iOS Safari
    }
// ==================================================
// FUNCTION: IS STANDALONE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS IOS START
// This function performs the is ios step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isIos() {
        var ua = window.navigator.userAgent || "";
        return /iPad|iPhone|iPod/.test(ua) ||
            (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    }
// ==================================================
// FUNCTION: IS IOS END
// This function ends here.
// ==================================================
// ==================================================
// FUNCTION: IS IOS SAFARI START
// This function performs the is ios safari step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isIosSafari() {
        if (!isIos()) return false;
        var ua = window.navigator.userAgent || "";
        return /Safari/.test(ua) &&
            !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|FBAN|FBAV|Instagram|Line|MicroMessenger/.test(ua);
    }
// ==================================================
// FUNCTION: IS IOS SAFARI END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS INSTALLED START
// This function performs the is installed step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isInstalled() {
        return isStandalone() || hasInstalledFlag() || installedRelated;
    }
// ==================================================
// FUNCTION: IS INSTALLED END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS SUPPRESSED START
// This function performs the is suppressed step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isSuppressed() {
        return isOpen || isInstalled() || isDismissed() || wasShownRecently();
    }
// ==================================================
// FUNCTION: IS SUPPRESSED END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SHOW NOTE START
// This function performs the show note step of this calculator.
// This is where this function's work happens.
// ==================================================
    function showNote(msg) {
        if (!note) return;
        note.textContent = msg;
        note.hidden = false;
    }
// ==================================================
// FUNCTION: SHOW NOTE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS USER BUSY START
// This function performs the is user busy step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isUserBusy() {
        var active = document.activeElement;
        if (active && active !== document.body) {
            if (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable) {
                return true;
            }
        }
        if (document.body && document.body.classList.contains("history-open")) return true;
        return false;
    }
// ==================================================
// FUNCTION: IS USER BUSY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: BUILD POPUP START
// This function performs the build popup step of this calculator.
// This is where this function's work happens.
// ==================================================
    function buildPopup() {
        if (popup || !document.body) return;

        popup = document.createElement("div");
        popup.className = "sip";
        popup.id = "smartInstallPopup";
        popup.hidden = true;
        popup.innerHTML =
            '<div class="sip__backdrop" data-sip-close aria-hidden="true"></div>' +
            '<section class="sip__sheet" role="dialog" aria-modal="true" aria-labelledby="sipTitle" aria-describedby="sipDesc" tabindex="-1">' +
                '<button class="sip__close" type="button" aria-label="Close" data-sip-close>&times;</button>' +
                '<div class="sip__brand">' +
                    '<img class="sip__icon" alt="" width="56" height="56" decoding="async">' +
                    '<div>' +
                        '<p class="sip__eyebrow">Metal Weight Calculator</p>' +
                        '<h2 class="sip__title" id="sipTitle">Add Metal Weight Calculator to Your Home Screen</h2>' +
                    '</div>' +
                '</div>' +
                '<p class="sip__desc" id="sipDesc">Get quick access to every Metal Weight Calculator tool directly from your mobile home screen or desktop.</p>' +
                '<div class="sip__ios" id="sipIos" hidden>' +
                    '<p class="sip__box-title">On iPhone/iPad (Safari):</p>' +
                    '<ol>' +
                        '<li>Tap the <strong>Share</strong> button in Safari.</li>' +
                        '<li>Select <strong>Add to Home Screen</strong>.</li>' +
                        '<li>Tap <strong>Add</strong> to install.</li>' +
                    '</ol>' +
                '</div>' +
                '<div class="sip__manual" id="sipManual" hidden>' +
                    '<p class="sip__box-title">Install from your browser:</p>' +
                    '<p><strong>Android Chrome:</strong> Open the three-dot menu, then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>' +
                    '<p><strong>Desktop Chrome / Edge:</strong> Use the install icon in the address bar, or open the browser menu and choose <strong>Install app</strong>.</p>' +
                    '<p><strong>Other browsers:</strong> Open the browser menu and choose <strong>Install</strong> or <strong>Add to Home Screen</strong>.</p>' +
                '</div>' +
                '<div class="sip__actions">' +
                    '<button class="sip__btn sip__btn--yes" id="sipYes" type="button">YES – Add to Home Screen</button>' +
                    '<button class="sip__btn sip__btn--no" id="sipNo" type="button" data-sip-close>NO – Maybe Later</button>' +
                '</div>' +
                '<p class="sip__note" aria-live="polite" hidden></p>' +
            '</section>';

        document.body.appendChild(popup);
        popup.querySelector(".sip__icon").src = iconUrl;
        sheet = popup.querySelector(".sip__sheet");
        yesButton = popup.querySelector("#sipYes");
        noButton = popup.querySelector("#sipNo");
        iosBox = popup.querySelector("#sipIos");
        manualBox = popup.querySelector("#sipManual");
        note = popup.querySelector(".sip__note");

        popup.addEventListener("click", function (event) {
            var t = event.target;
            var closer = t && t.closest ? t.closest("[data-sip-close]") : null;
            if (closer) {
                event.preventDefault();
                onNo();
            }
        });

        yesButton.addEventListener("click", onYes);
        document.addEventListener("keydown", onKeyDown, false);
    }
// ==================================================
// FUNCTION: BUILD POPUP END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SET MODE START
// This function performs the set mode step of this calculator.
// This is where this function's work happens.
// ==================================================
    function setMode(mode) {
        currentMode = mode;
        if (!popup) return;
        popup.setAttribute("data-mode", mode);
        iosBox.hidden = mode !== "ios";
        manualBox.hidden = mode !== "manual";
        if (mode === "ios") {
            sheet.setAttribute("aria-describedby", "sipDesc sipIos");
            yesButton.textContent = "YES – Got It";
        } else if (mode === "manual") {
            sheet.setAttribute("aria-describedby", "sipDesc sipManual");
            yesButton.textContent = "YES – Got It";
        } else {
            sheet.setAttribute("aria-describedby", "sipDesc");
            yesButton.textContent = "YES – Add to Home Screen";
        }
    }
// ==================================================
// FUNCTION: SET MODE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SHOW POPUP START
// This function performs the show popup step of this calculator.
// This is where this function's work happens.
// ==================================================
    function showPopup(mode, force) {
        if (isInstalled()) return;
        if (isOpen) {
            if (sheet) {
                try { sheet.focus({ preventScroll: true }); } catch (e) { try { sheet.focus(); } catch (e2) {} }
            }
            return;
        }
        if (!document.body) { scheduleShow(mode, 600); return; }
        buildPopup();
        if (!popup) return;
        if (!force && isSuppressed()) return;

        markShown();
        isOpen = true;
        note.hidden = true;
        note.textContent = "";
        yesButton.disabled = false;
        yesButton.removeAttribute("data-close");
        setMode(mode);
        popup.hidden = false;
        popup.classList.add("is-open");

        lastFocused = document.activeElement;
        window.setTimeout(function () {
            if (isOpen && yesButton) {
                try { yesButton.focus({ preventScroll: true }); } catch (e) { try { yesButton.focus(); } catch (e2) {} }
            }
        }, 40);
    }
// ==================================================
// FUNCTION: SHOW POPUP END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HIDE POPUP START
// This function performs the hide popup step of this calculator.
// This is where this function's work happens.
// ==================================================
    function hidePopup() {
        isOpen = false;
        if (!popup || popup.hidden) return;
        popup.hidden = true;
        popup.classList.remove("is-open");
        if (lastFocused && typeof lastFocused.focus === "function") {
            try { lastFocused.focus({ preventScroll: true }); } catch (e) { try { lastFocused.focus(); } catch (e2) {} }
        }
        lastFocused = null;
    }
// ==================================================
// FUNCTION: HIDE POPUP END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ON NO START
// This function performs the on no step of this calculator.
// This is where this function's work happens.
// ==================================================
    function onNo() {
        setCooldown(DISMISS_DAYS);
        hidePopup();
    }
// ==================================================
// FUNCTION: ON NO END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ON YES START
// This function performs the on yes step of this calculator.
// This is where this function's work happens.
// ==================================================
    function onYes() {
        if (!yesButton) return;
        if (yesButton.getAttribute("data-close")) {
            hidePopup();
            return;
        }

        if (currentMode === "ios") {
            // iOS Safari does not support beforeinstallprompt; the Share steps
            // are already visible, so "Got It" simply closes the dialog.
            setCooldown(DISMISS_DAYS);
            hidePopup();
            return;
        }

        if (currentMode === "manual") {
            // Manual instructions are already visible; "Got It" simply closes.
            setCooldown(DISMISS_DAYS);
            hidePopup();
            return;
        }

        if (!deferredPrompt) {
            // The native prompt is no longer available; show manual instructions.
            manualBox.hidden = false;
            sheet.setAttribute("aria-describedby", "sipDesc sipManual");
            showNote("Automatic install isn't available in this browser. Use your browser menu to install or add a shortcut.");
            yesButton.setAttribute("data-close", "1");
            yesButton.textContent = "Close";
            setCooldown(DISMISS_DAYS);
            return;
        }

        var promptEvent = deferredPrompt;
        deferredPrompt = null; // beforeinstallprompt can be used only once
        yesButton.disabled = true;

        try {
            promptEvent.prompt();
            Promise.resolve(promptEvent.userChoice).then(function (choice) {
                if (choice && choice.outcome === "accepted") {
                    // appinstalled event will mark installed; set a short settle cooldown just in case.
                    setCooldown(INSTALL_SETTLE_DAYS);
                } else {
                    setCooldown(DISMISS_DAYS);
                }
                hidePopup();
            }).catch(function () {
                yesButton.disabled = false;
                manualBox.hidden = false;
                showNote("Installation couldn't be completed automatically. Please use your browser menu to install.");
                yesButton.setAttribute("data-close", "1");
                yesButton.textContent = "Close";
                setCooldown(DISMISS_DAYS);
            });
        } catch (e) {
            yesButton.disabled = false;
            manualBox.hidden = false;
            showNote("Installation couldn't be completed automatically. Please use your browser menu to install.");
            yesButton.setAttribute("data-close", "1");
            yesButton.textContent = "Close";
            setCooldown(DISMISS_DAYS);
        }
    }
// ==================================================
// FUNCTION: ON YES END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: OPEN INSTALL FLOW START
// This function performs the open install flow step of this calculator.
// This is where this function's work happens.
// ==================================================
    function openInstallFlow() {
        if (installFlowPending) {
            return Promise.resolve({ outcome: "pending" });
        }

        if (deferredPrompt) {
            var promptEvent = deferredPrompt;
            deferredPrompt = null; // A beforeinstallprompt event can only be used once.
            installFlowPending = true;

            try {
                promptEvent.prompt();
                return Promise.resolve(promptEvent.userChoice).then(function (choice) {
                    installFlowPending = false;
                    var accepted = Boolean(choice && choice.outcome === "accepted");
                    setCooldown(accepted ? INSTALL_SETTLE_DAYS : DISMISS_DAYS);
                    if (accepted) {
                        // appinstalled is authoritative; this is only a fallback
                        // for browsers that expose getInstalledRelatedApps.
                        window.setTimeout(detectInstalledRelatedApp, 1200);
                    }
                    return { outcome: accepted ? "accepted" : "dismissed" };
                }).catch(function () {
                    installFlowPending = false;
                    showPopup("manual", true);
                    return { outcome: "manual" };
                });
            } catch (e) {
                installFlowPending = false;
                showPopup("manual", true);
                return Promise.resolve({ outcome: "manual" });
            }
        }

        if (isInstalled()) {
            return Promise.resolve({ outcome: "installed" });
        }

        if (isOpen) {
            if (sheet) {
                try { sheet.focus({ preventScroll: true }); } catch (e) { try { sheet.focus(); } catch (e2) {} }
            }
            return Promise.resolve({ outcome: "open" });
        }

        var mode = isIosSafari() ? "ios" : "manual";
        showPopup(mode, true);
        return Promise.resolve({ outcome: mode });
    }
// ==================================================
// FUNCTION: OPEN INSTALL FLOW END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ON KEY DOWN START
// This function performs the on key down step of this calculator.
// This is where this function's work happens.
// ==================================================
    function onKeyDown(event) {
        if (!isOpen || !sheet) return;
        if (event.key === "Escape" || event.key === "Esc") {
            event.preventDefault();
            onNo();
            return;
        }
        if (event.key === "Tab") {
            var focusable = sheet.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }
// ==================================================
// FUNCTION: ON KEY DOWN END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SCHEDULE SHOW START
// This function performs the schedule show step of this calculator.
// This is where this function's work happens.
// ==================================================
    function scheduleShow(mode, delay) {
        // The global "Add Shortcut" header button owns the install flow on this
        // site. Skip passive auto-prompts so the user never sees two dialogs.
        if (window.__jadhavAddShortcutOwnsInstallPrompt) return;

        if (showTimer) { window.clearTimeout(showTimer); showTimer = 0; }
        if (isSuppressed()) return;

        showTimer = window.setTimeout(function () {
            showTimer = 0;
            if (isSuppressed()) return;

            if (mode === "native" && !deferredPrompt) return;
            if (mode === "ios" && !isIosSafari()) return;

            if (document.visibilityState && document.visibilityState !== "visible") {
                scheduleShow(mode, 1500);
                return;
            }
            if (isUserBusy()) {
                scheduleShow(mode, 4000);
                return;
            }
            showPopup(mode);
        }, delay);
    }
// ==================================================
// FUNCTION: SCHEDULE SHOW END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: DETECT INSTALLED RELATED APP START
// This function performs the detect installed related app step of this calculator.
// This is where this function's work happens.
// ==================================================
    function detectInstalledRelatedApp() {
        if (!navigator.getInstalledRelatedApps) return;
        try {
            navigator.getInstalledRelatedApps().then(function (apps) {
                if (!apps || !apps.length) return;
                for (var i = 0; i < apps.length; i += 1) {
                    if (apps[i] && apps[i].platform === "webapp") {
                        installedRelated = true;
                        markInstalled();
                        hidePopup();
                        return;
                    }
                }
            }).catch(function () { /* optional API */ });
        } catch (e) { /* optional API */ }
    }
// ==================================================
// FUNCTION: DETECT INSTALLED RELATED APP END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: WATCH DISPLAY MODE START
// This function performs the watch display mode step of this calculator.
// This is where this function's work happens.
// ==================================================
    function watchDisplayMode() {
        if (!window.matchMedia) return;
        var queries = [
            "(display-mode: standalone)",
            "(display-mode: fullscreen)",
            "(display-mode: minimal-ui)",
            "(display-mode: window-controls-overlay)"
        ];
        var onChange = function () {
            if (isStandalone()) {
                markInstalled();
                hidePopup();
            }
        };
        for (var i = 0; i < queries.length; i += 1) {
            try {
                var m = window.matchMedia(queries[i]);
                if (m.addEventListener) m.addEventListener("change", onChange);
                else if (m.addListener) m.addListener(onChange);
            } catch (e) { /* ignore */ }
        }
    }
// ==================================================
// FUNCTION: WATCH DISPLAY MODE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: INIT START
// This function performs the init step of this calculator.
// This is where this function's work happens.
// ==================================================
    function init() {
        if (!document.body) return;
        buildPopup();
        watchDisplayMode();

        if (isStandalone()) {
            markInstalled();
            return;
        }
        if (hasInstalledFlag()) return;

        detectInstalledRelatedApp();

        // iOS Safari: show instructions since beforeinstallprompt is unavailable.
        if (isIosSafari()) {
            scheduleShow("ios", SHOW_DELAY + 1000);
        }
    }
// ==================================================
// FUNCTION: INIT END
// This function ends here.
// ==================================================

    window.addEventListener("beforeinstallprompt", function (event) {
        // Use the native install prompt flow on supported browsers.
        event.preventDefault();
        deferredPrompt = event;
        if (isSuppressed()) return;
        scheduleShow("native", SHOW_DELAY);
    });

    window.addEventListener("appinstalled", function () {
        deferredPrompt = null;
        installFlowPending = false;
        installedRelated = true;
        markInstalled();
        hidePopup();
    });

    // Public API used by the global "Add Shortcut" header button.
    window.JadhavInstall = {
        isInstalled: isInstalled,
        canPrompt: function () { return Boolean(deferredPrompt); },
        open: openInstallFlow
    };

    // Register service worker (required for installability/PWA) without affecting calculations.
    if ("serviceWorker" in navigator) {
        try {
            navigator.serviceWorker.register(serviceWorkerUrl).catch(function () { /* ignore */ });
        } catch (e) { /* ignore */ }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
}());
/* ==================================================
   INSTALL POPUP JAVASCRIPT END
   This JavaScript file ends here.
================================================== */