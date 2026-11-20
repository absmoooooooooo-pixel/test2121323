/* ==================================================
   DOWNLOAD APP JAVASCRIPT START
   Install prompt for the app and its dialog.
   Here is the logic for installing the app.
================================================== */
/*
 * Global "Add Shortcut" header button.
 *
 * Injects one reusable button immediately before the All Tools link on
 * calculator pages, and into the homepage app header. Clicking it shows a
 * confirmation dialog; the native browser install/shortcut prompt is only
 * opened after the user presses "OK - Add Shortcut".
 *
 * Chrome/Edge fire beforeinstallprompt a few seconds after the page loads, so
 * pressing OK before that waits briefly for the event instead of failing.
 * Browsers without a usable event get manual browser-menu instructions, and
 * pages that cannot be installed at all (file://, insecure origins) get an
 * explanation instead of misleading steps.
 */
(function () {
    "use strict";

    if (window.__jadhavAddShortcutLoaded) return;
    window.__jadhavAddShortcutLoaded = true;

    // This button owns the site's single shortcut/install flow. The shared
    // install helper reads this flag and skips its passive auto-prompt so the
    // user never sees two installation dialogs.
    window.__jadhavAddShortcutOwnsInstallPrompt = true;

    var BUTTON_ID = "addShortcutBtn";
    var APP_NAME = "Metal Weight Calculator";
    var OK_LABEL = "OK \u2013 Add Shortcut";
    var WAIT_MS = 9000;

    var button = null;
    var dialog = null;
    var card = null;
    var okButton = null;
    var cancelButton = null;
    var instructions = null;
    var note = null;

    var lastFocus = null;
    var isOpen = false;
    var prompting = false;
    var promptEvent = null;
    var installedThisSession = false;
    var installedRelated = false;
    var waiting = false;
    var waitTimer = 0;
    var previousOverflow = "";

    var scriptUrl = "";
    try {
        var script = document.currentScript;
        if (!script || !script.src) {
            var scripts = document.getElementsByTagName("script");
            for (var i = scripts.length - 1; i >= 0; i -= 1) {
                if (/add-shortcut\.js(?:[?#]|$)/.test(scripts[i].src)) {
                    script = scripts[i];
                    break;
                }
            }
        }
        scriptUrl = script && script.src;
    } catch (e) { scriptUrl = ""; }

    var iconUrl = "";
    try {
        if (scriptUrl) iconUrl = new URL("../icons/icon-192.png", scriptUrl).href;
    } catch (e) { iconUrl = ""; }

    var DEFAULT_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
            '<path d="M12 4v9"/>' +
            '<path d="m8.5 9.5 3.5 3.5 3.5-3.5"/>' +
            '<path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/>' +
        '</svg>';

    var INSTALLED_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
            '<path d="M20 6 9 17l-5-5"/>' +
        '</svg>';

// ==================================================
// FUNCTION: IS STANDALONE START
// This function performs the is standalone step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isStandalone() {
        try {
            if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
            if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return true;
        } catch (e) { /* ignore */ }
        return window.navigator.standalone === true;
    }
// ==================================================
// FUNCTION: IS STANDALONE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS INSTALLED START
// This function performs the is installed step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isInstalled() {
        // Only real installation evidence counts. A persisted "installed"
        // flag is deliberately not trusted: a stale flag must never disable
        // the button on a browser without beforeinstallprompt (e.g. Safari).
        return isStandalone() || installedThisSession;
    }
// ==================================================
// FUNCTION: IS INSTALLED END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS LOOPBACK HOST START
// This function performs the is loopback host step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isLoopbackHost() {
        var host = window.location.hostname || "";
        return host === "localhost" || host === "[::1]" || /^127\./.test(host);
    }
// ==================================================
// FUNCTION: IS LOOPBACK HOST END
// This function ends here.
// ==================================================

    // Returns a message when the current page cannot install a shortcut at all.
// ==================================================
// FUNCTION: ENVIRONMENT ISSUE START
// This function performs the environment issue step of this calculator.
// This is where this function's work happens.
// ==================================================
    function environmentIssue() {
        if (window.location.protocol === "file:") {
            return "This copy of the site is open as a local file. Browsers can only add shortcuts to " +
                "pages opened over HTTPS or http://localhost, and the browser menu offers no shortcut " +
                "option for file:// pages. Open the website through its web address (or run a local " +
                "server and open http://localhost) and try again.";
        }
        if (window.location.protocol !== "https:" && !isLoopbackHost()) {
            return "Shortcuts require a secure connection. This page is served over plain HTTP, so the " +
                "browser will not offer its install or shortcut prompt. Open the HTTPS version of the " +
                "website and try again.";
        }
        return null;
    }
// ==================================================
// FUNCTION: ENVIRONMENT ISSUE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SET BUTTON CONTENT START
// This function performs the set button content step of this calculator.
// This is where this function's work happens.
// ==================================================
    function setButtonContent(installed) {
        if (!button) return;
        button.innerHTML = (installed ? INSTALLED_ICON : DEFAULT_ICON) +
            '<span class="add-shortcut-label">' + (installed ? "Installed" : "Download App") + '</span>';
    }
// ==================================================
// FUNCTION: SET BUTTON CONTENT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SET INSTALLED STATE START
// This function performs the set installed state step of this calculator.
// This is where this function's work happens.
// ==================================================
    function setInstalledState() {
        if (!button) return;
        button.classList.add("is-installed");
        button.classList.remove("is-busy");
        button.disabled = true;
        button.setAttribute("aria-label", "Metal Weight Calculator is installed");
        button.title = "Metal Weight Calculator is installed";
        setButtonContent(true);
    }
// ==================================================
// FUNCTION: SET INSTALLED STATE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SET ACTIVE STATE START
// This function performs the set active state step of this calculator.
// This is where this function's work happens.
// ==================================================
    function setActiveState() {
        if (!button || isStandalone()) return;
        button.classList.remove("is-installed");
        button.classList.remove("is-busy");
        button.disabled = false;
        button.setAttribute("aria-label", "Download the Metal Weight Calculator app");
        button.title = "Download App";
        setButtonContent(false);
    }
// ==================================================
// FUNCTION: SET ACTIVE STATE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: GET HEADER CONTEXT START
// This function performs the get header context step of this calculator.
// This is where this function's work happens.
// ==================================================
    function getHeaderContext() {
        var calcHeader = document.querySelector("header.header");
        if (calcHeader) {
            return { container: calcHeader, before: calcHeader.querySelector(".home-pill") };
        }

        var appHeader = document.querySelector("header.app-header .app-header-inner");
        if (appHeader) {
            return { container: appHeader, before: null };
        }

        return null;
    }
// ==================================================
// FUNCTION: GET HEADER CONTEXT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CREATE BUTTON START
// This function performs the create button step of this calculator.
// This is where this function's work happens.
// ==================================================
    function createButton() {
        var element = document.createElement("button");
        element.type = "button";
        element.id = BUTTON_ID;
        element.className = "add-shortcut-btn";
        element.setAttribute("aria-label", "Download the Metal Weight Calculator app");
        element.title = "Download App";
        element.innerHTML = DEFAULT_ICON + '<span class="add-shortcut-label">Download App</span>';
        element.addEventListener("click", onButtonClick);
        return element;
    }
// ==================================================
// FUNCTION: CREATE BUTTON END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: INJECT BUTTON START
// This function performs the inject button step of this calculator.
// This is where this function's work happens.
// ==================================================
    function injectButton() {
        if (document.getElementById(BUTTON_ID)) {
            button = document.getElementById(BUTTON_ID);
            return true;
        }

        var context = getHeaderContext();
        if (!context || !context.container) return false;

        button = createButton();
        if (context.before && context.before.parentNode === context.container) {
            context.container.insertBefore(button, context.before);
        } else {
            context.container.appendChild(button);
        }
        return true;
    }
// ==================================================
// FUNCTION: INJECT BUTTON END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: BUILD DIALOG START
// This function performs the build dialog step of this calculator.
// This is where this function's work happens.
// ==================================================
    function buildDialog() {
        if (dialog || !document.body) return;

        dialog = document.createElement("div");
        dialog.className = "asc-dialog";
        dialog.id = "addShortcutDialog";
        dialog.hidden = true;
        dialog.innerHTML =
            '<div class="asc-dialog__backdrop" data-asc-close aria-hidden="true"></div>' +
            '<section class="asc-dialog__card" role="dialog" aria-modal="true" ' +
            'aria-labelledby="ascDialogTitle" aria-describedby="ascDialogPoints" tabindex="-1">' +
                '<button class="asc-dialog__close" type="button" aria-label="Close" data-asc-close>&times;</button>' +
                '<div class="asc-dialog__brand">' +
                    '<img class="asc-dialog__icon" alt="" width="52" height="52" decoding="async">' +
                    '<div class="asc-dialog__brand-copy">' +
                        '<p class="asc-dialog__eyebrow">' + APP_NAME + '</p>' +
                        '<h2 class="asc-dialog__title" id="ascDialogTitle">Add Metal Weight Calculator Shortcut</h2>' +
                    '</div>' +
                '</div>' +
                '<ul class="asc-dialog__points" id="ascDialogPoints">' +
                    '<li>A shortcut for the <strong>Metal Weight Calculator</strong> website will be added to your ' +
                    'browser or device, depending on browser support.</li>' +
                    '<li>The shortcut will open the website&rsquo;s homepage directly.</li>' +
                    '<li>You can access the website quickly without manually entering the URL.</li>' +
                '</ul>' +
                '<div class="asc-dialog__instructions" hidden>' +
                    '<p class="asc-dialog__instructions-title">Add the shortcut from your browser menu</p>' +
                    '<p><strong>Chrome (desktop):</strong> Click the install icon in the address bar ' +
                    '(a small screen with a down arrow), or open the &#8942; menu &rarr; ' +
                    '<strong>Cast, save, and share</strong> &rarr; <strong>Install page as app</strong>.</p>' +
                    '<p><strong>Microsoft Edge (desktop):</strong> Click the install icon in the address bar, ' +
                    'or open the &#8942; menu &rarr; <strong>Apps</strong> &rarr; ' +
                    '<strong>Install this site as an app</strong>.</p>' +
                    '<p><strong>Other Chromium browsers:</strong> Open the browser menu and choose ' +
                    '<strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>' +
                    '<p><strong>Android (Chrome or Edge):</strong> Open the &#8942; menu and tap ' +
                    '<strong>Add to Home screen</strong> or <strong>Install app</strong>.</p>' +
                    '<p><strong>iPhone / iPad (Safari):</strong> Tap <strong>Share</strong>, then ' +
                    '<strong>Add to Home Screen</strong>.</p>' +
                    '<p class="asc-dialog__instructions-hint">Already installed but the shortcut is missing? ' +
                    'Open <strong>chrome://apps</strong> (or <strong>edge://apps</strong>), remove the app, ' +
                    'then add it again from this button.</p>' +
                '</div>' +
                '<p class="asc-dialog__note" aria-live="polite" hidden></p>' +
                '<div class="asc-dialog__actions">' +
                    '<button class="asc-dialog__btn asc-dialog__btn--primary" id="ascDialogOk" type="button">' +
                        OK_LABEL + '</button>' +
                    '<button class="asc-dialog__btn asc-dialog__btn--secondary" id="ascDialogCancel" ' +
                        'type="button">Cancel</button>' +
                '</div>' +
            '</section>';

        document.body.appendChild(dialog);

        card = dialog.querySelector(".asc-dialog__card");
        okButton = dialog.querySelector("#ascDialogOk");
        cancelButton = dialog.querySelector("#ascDialogCancel");
        instructions = dialog.querySelector(".asc-dialog__instructions");
        note = dialog.querySelector(".asc-dialog__note");

        var icon = dialog.querySelector(".asc-dialog__icon");
        if (icon && iconUrl) {
            icon.src = iconUrl;
        } else if (icon && icon.parentNode) {
            icon.parentNode.removeChild(icon);
        }

        dialog.addEventListener("click", function (event) {
            var target = event.target;
            if (target && target.closest && target.closest("[data-asc-close]")) {
                event.preventDefault();
                closeDialog();
            }
        });

        okButton.addEventListener("click", onConfirm);
        cancelButton.addEventListener("click", closeDialog);
        document.addEventListener("keydown", onKeyDown, false);
    }
// ==================================================
// FUNCTION: BUILD DIALOG END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SHOW NOTE START
// This function performs the show note step of this calculator.
// This is where this function's work happens.
// ==================================================
    function showNote(message, variant) {
        if (!note) return;
        note.classList.remove("asc-dialog__note--info", "asc-dialog__note--warning");
        if (variant) note.classList.add("asc-dialog__note--" + variant);
        note.textContent = message;
        note.hidden = false;
    }
// ==================================================
// FUNCTION: SHOW NOTE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: HIDE NOTE START
// This function performs the hide note step of this calculator.
// This is where this function's work happens.
// ==================================================
    function hideNote() {
        if (!note) return;
        note.hidden = true;
        note.textContent = "";
        note.classList.remove("asc-dialog__note--info", "asc-dialog__note--warning");
    }
// ==================================================
// FUNCTION: HIDE NOTE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: FOCUS ELEMENT START
// This function performs the focus element step of this calculator.
// This is where this function's work happens.
// ==================================================
    function focusElement(element) {
        if (!element) return;
        window.setTimeout(function () {
            try { element.focus({ preventScroll: true }); } catch (e) { try { element.focus(); } catch (e2) {} }
        }, 30);
    }
// ==================================================
// FUNCTION: FOCUS ELEMENT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CLEAR WAIT START
// This function performs the clear wait step of this calculator.
// This is where this function's work happens.
// ==================================================
    function clearWait() {
        if (waitTimer) {
            window.clearTimeout(waitTimer);
            waitTimer = 0;
        }
        waiting = false;
        if (button) button.classList.remove("is-busy");
    }
// ==================================================
// FUNCTION: CLEAR WAIT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RESET CONFIRM STATE START
// This function performs the reset confirm state step of this calculator.
// This is where this function's work happens.
// ==================================================
    function resetConfirmState() {
        if (!okButton) return;
        okButton.disabled = false;
        okButton.textContent = OK_LABEL;
        okButton.removeAttribute("data-close");
        cancelButton.textContent = "Cancel";
        instructions.hidden = true;
        hideNote();
    }
// ==================================================
// FUNCTION: RESET CONFIRM STATE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: OPEN DIALOG START
// This function performs the open dialog step of this calculator.
// This is where this function's work happens.
// ==================================================
    function openDialog() {
        if (!document.body) return;
        buildDialog();
        if (!dialog) return;

        if (isInstalled()) {
            setInstalledState();
            return;
        }

        if (isOpen) {
            focusElement(card);
            return;
        }

        isOpen = true;
        prompting = false;
        waiting = false;
        resetConfirmState();

        lastFocus = document.activeElement;
        previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";

        dialog.hidden = false;
        dialog.classList.add("is-open");
        focusElement(card);
    }
// ==================================================
// FUNCTION: OPEN DIALOG END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CLOSE DIALOG START
// This function performs the close dialog step of this calculator.
// This is where this function's work happens.
// ==================================================
    function closeDialog() {
        if (!dialog || !isOpen) return;
        isOpen = false;
        clearWait();
        if (button) button.classList.remove("is-busy");
        dialog.hidden = true;
        dialog.classList.remove("is-open");
        document.documentElement.style.overflow = previousOverflow || "";
        previousOverflow = "";

        if (lastFocus && typeof lastFocus.focus === "function") {
            try { lastFocus.focus({ preventScroll: true }); } catch (e) { try { lastFocus.focus(); } catch (e2) {} }
        }
        lastFocus = null;
    }
// ==================================================
// FUNCTION: CLOSE DIALOG END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SHOW MANUAL STEPS START
// This function performs the show manual steps step of this calculator.
// This is where this function's work happens.
// ==================================================
    function showManualSteps(message) {
        if (!dialog || !instructions) return;
        instructions.hidden = false;
        showNote(message, "warning");
        okButton.disabled = false;
        okButton.textContent = "Try Again";
        okButton.removeAttribute("data-close");
        cancelButton.textContent = "Close";
        if (card) {
            try { card.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
            card.scrollTop = card.scrollHeight;
        }
    }
// ==================================================
// FUNCTION: SHOW MANUAL STEPS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SHOW BLOCKED START
// This function performs the show blocked step of this calculator.
// This is where this function's work happens.
// ==================================================
    function showBlocked(message) {
        if (!dialog) return;
        instructions.hidden = true;
        showNote(message, "warning");
        okButton.disabled = false;
        okButton.textContent = "Close";
        okButton.setAttribute("data-close", "1");
        cancelButton.textContent = "Close";
        if (card) card.scrollTop = 0;
    }
// ==================================================
// FUNCTION: SHOW BLOCKED END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SHOW ALREADY INSTALLED START
// This function performs the show already installed step of this calculator.
// This is where this function's work happens.
// ==================================================
    function showAlreadyInstalled() {
        if (!dialog) return;
        instructions.hidden = true;
        showNote(
            "Metal Weight Calculator is already installed in this browser. Open it from the Start menu, your " +
            "desktop, or chrome://apps (edge://apps in Edge). If its shortcut was removed, remove the app " +
            "there and add it again with this button.",
            "info"
        );
        okButton.disabled = false;
        okButton.textContent = "Close";
        okButton.setAttribute("data-close", "1");
        cancelButton.textContent = "Close";
        if (card) card.scrollTop = 0;
    }
// ==================================================
// FUNCTION: SHOW ALREADY INSTALLED END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RESTORE AFTER PROMPT START
// This function performs the restore after prompt step of this calculator.
// This is where this function's work happens.
// ==================================================
    function restoreAfterPrompt() {
        prompting = false;
        clearWait();
        if (button) button.classList.remove("is-busy");
        if (!okButton) return;
        okButton.disabled = false;
        okButton.textContent = OK_LABEL;
        okButton.removeAttribute("data-close");
    }
// ==================================================
// FUNCTION: RESTORE AFTER PROMPT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: PROMPT WITH EVENT START
// This function performs the prompt with event step of this calculator.
// This is where this function's work happens.
// ==================================================
    function promptWithEvent() {
        var event = promptEvent;
        if (!event) return;

        clearWait();
        promptEvent = null; // one event can be prompted only once
        prompting = true;
        if (button) button.classList.add("is-busy");
        okButton.disabled = true;
        okButton.textContent = "Opening browser prompt\u2026";
        hideNote();

        try {
            event.prompt();
        } catch (e) {
            restoreAfterPrompt();
            showManualSteps(
                "The browser couldn't open its install prompt. " +
                "Use the steps below to add the shortcut manually."
            );
            return;
        }

        Promise.resolve(event.userChoice).then(function () {
            restoreAfterPrompt();
            // Never claim the shortcut exists here: only appinstalled or
            // standalone display mode prove it was actually created.
            closeDialog();
        }).catch(function () {
            restoreAfterPrompt();
            showManualSteps(
                "The install prompt couldn't be completed. " +
                "Use the steps below to add the shortcut manually."
            );
        });
    }
// ==================================================
// FUNCTION: PROMPT WITH EVENT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: WAIT FOR PROMPT START
// This function performs the wait for prompt step of this calculator.
// This is where this function's work happens.
// ==================================================
    function waitForPrompt() {
        waiting = true;
        okButton.disabled = true;
        okButton.textContent = "Waiting for browser\u2026";
        okButton.removeAttribute("data-close");
        cancelButton.textContent = "Cancel";
        instructions.hidden = true;
        showNote(
            "Waiting for your browser to offer its install prompt. This usually takes a few seconds\u2026",
            "info"
        );
        if (button) button.classList.add("is-busy");

        waitTimer = window.setTimeout(function () {
            waitTimer = 0;
            waiting = false;
            if (button) button.classList.remove("is-busy");
            if (!isOpen) return;
            if (promptEvent) {
                promptWithEvent();
                return;
            }
            showManualSteps(
                "Your browser didn't offer its automatic install prompt. Press Try Again, or add the " +
                "shortcut from the browser menu using the steps below."
            );
        }, WAIT_MS);
    }
// ==================================================
// FUNCTION: WAIT FOR PROMPT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: REQUEST NATIVE PROMPT START
// This function performs the request native prompt step of this calculator.
// This is where this function's work happens.
// ==================================================
    function requestNativePrompt() {
        if (isInstalled()) {
            closeDialog();
            setInstalledState();
            return;
        }

        if (promptEvent) {
            promptWithEvent();
            return;
        }

        var issue = environmentIssue();
        if (issue) {
            showBlocked(issue);
            return;
        }

        if (installedRelated) {
            showAlreadyInstalled();
            return;
        }

        waitForPrompt();
    }
// ==================================================
// FUNCTION: REQUEST NATIVE PROMPT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ON CONFIRM START
// This function performs the on confirm step of this calculator.
// This is where this function's work happens.
// ==================================================
    function onConfirm() {
        if (!isOpen) return;

        if (okButton && okButton.getAttribute("data-close")) {
            closeDialog();
            return;
        }

        if (prompting) return;

        requestNativePrompt();
    }
// ==================================================
// FUNCTION: ON CONFIRM END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: MARK PROMPT READY START
// This function performs the mark prompt ready step of this calculator.
// This is where this function's work happens.
// ==================================================
    function markPromptReady() {
        if (!dialog || !isOpen || prompting || waiting) return;
        instructions.hidden = true;
        okButton.disabled = false;
        okButton.textContent = OK_LABEL;
        okButton.removeAttribute("data-close");
        cancelButton.textContent = "Cancel";
        showNote(
            "Your browser is ready to add the shortcut. Press \u201cOK \u2013 Add Shortcut\u201d to continue.",
            "info"
        );
    }
// ==================================================
// FUNCTION: MARK PROMPT READY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ON KEY DOWN START
// This function performs the on key down step of this calculator.
// This is where this function's work happens.
// ==================================================
    function onKeyDown(event) {
        if (!isOpen) return;

        if (event.key === "Escape" || event.key === "Esc") {
            event.preventDefault();
            closeDialog();
            return;
        }

        if (event.key !== "Tab" || !card) return;

        var focusable = card.querySelectorAll(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        );
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
// ==================================================
// FUNCTION: ON KEY DOWN END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ON BUTTON CLICK START
// This function performs the on button click step of this calculator.
// This is where this function's work happens.
// ==================================================
    function onButtonClick() {
        if (!button || button.disabled) return;
        openDialog();
    }
// ==================================================
// FUNCTION: ON BUTTON CLICK END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: DETECT INSTALLED RELATED START
// This function performs the detect installed related step of this calculator.
// This is where this function's work happens.
// ==================================================
    function detectInstalledRelated() {
        if (!navigator.getInstalledRelatedApps) return;
        try {
            Promise.resolve(navigator.getInstalledRelatedApps()).then(function (apps) {
                if (!apps || !apps.length) return;
                for (var i = 0; i < apps.length; i += 1) {
                    if (apps[i] && apps[i].platform === "webapp") {
                        installedRelated = true;
                        return;
                    }
                }
            }).catch(function () { /* optional API */ });
        } catch (e) { /* optional API */ }
    }
// ==================================================
// FUNCTION: DETECT INSTALLED RELATED END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ENSURE THEME COLOR START
// This function performs the ensure theme color step of this calculator.
// This is where this function's work happens.
// ==================================================
    function ensureThemeColor() {
        if (!document.head || document.querySelector('meta[name="theme-color"]')) return;
        var meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = "#087f7b";
        document.head.appendChild(meta);
    }
// ==================================================
// FUNCTION: ENSURE THEME COLOR END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: GROUP HEADER ACTIONS START
// This function performs the group header actions step of this calculator.
// This is where this function's work happens.
// ==================================================
    function groupHeaderActions() {
        var header = document.querySelector("header.header");
        if (!header) return;
        var btns = [
            header.querySelector(".add-shortcut-btn"),
            header.querySelector(".home-pill"),
            header.querySelector(".history-trigger")
        ].filter(Boolean);
        if (!btns.length) return;
        var group = header.querySelector(".header-actions-group");
        if (!group) {
            group = document.createElement("div");
            group.className = "header-actions-group";
            header.appendChild(group);
        }
        // Keep required order: Add Shortcut, All Tools, History
        var order = [".add-shortcut-btn", ".home-pill", ".history-trigger"];
        order.forEach(function (sel) {
            var el = header.querySelector(sel);
            if (el) group.appendChild(el);
        });
    }
// ==================================================
// FUNCTION: GROUP HEADER ACTIONS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: INIT START
// This function performs the init step of this calculator.
// This is where this function's work happens.
// ==================================================
    function init() {
        ensureThemeColor();
        if (!injectButton()) return;

        if (isInstalled()) {
            setInstalledState();
        } else {
            setActiveState();
        }

        detectInstalledRelated();
        groupHeaderActions();
        // History button is injected by shared history script; regroup when it appears.
        if (typeof MutationObserver !== "undefined" && document.querySelector("header.header")) {
            var obs = new MutationObserver(function () { groupHeaderActions(); });
            obs.observe(document.querySelector("header.header"), { childList: true });
            window.setTimeout(function () { obs.disconnect(); groupHeaderActions(); }, 2000);
        }

        window.addEventListener("jadhav:installed", function () {
            installedThisSession = true;
            setInstalledState();
            if (isOpen) closeDialog();
        });
        window.addEventListener("appinstalled", function () {
            promptEvent = null;
            prompting = false;
            installedThisSession = true;
            setInstalledState();
            if (isOpen) closeDialog();
        });
        window.addEventListener("pageshow", function () {
            if (isInstalled()) setInstalledState();
        });
    }
// ==================================================
// FUNCTION: INIT END
// This function ends here.
// ==================================================

    window.addEventListener("beforeinstallprompt", function (event) {
        // Chrome/Edge/Chromium only fire this when the site can be installed.
        // Keep the event for the user's explicit "OK - Add Shortcut" click.
        event.preventDefault();
        promptEvent = event;
        if (!isStandalone()) setActiveState();

        if (!isOpen || prompting) return;

        if (waiting) {
            // The dialog is already waiting for this event: open the native
            // prompt immediately, without asking the user to press OK again.
            promptWithEvent();
        } else {
            markPromptReady();
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
}());

/*
 * Site-wide browser context menu suppression.
 *
 * This shared file is loaded by every page. The listener is registered on the
 * document in the capture phase, so it also covers calculator panels and any
 * component created after load. Only the context menu is suppressed: clicks,
 * typing, input fields, dropdowns, scrolling and keyboard input are untouched.
 */
(function () {
    "use strict";

    document.addEventListener("contextmenu", function (event) {
        event.preventDefault();
    }, true);
}());

/* ==================================================
   DOWNLOAD APP JAVASCRIPT END
   This JavaScript file ends here.
================================================== */