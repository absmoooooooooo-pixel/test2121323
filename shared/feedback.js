/* ==================================================
   FEEDBACK DIALOG JAVASCRIPT START
   Opens and closes the feedback form dialog.
   Here is the logic for opening and closing the feedback form.
================================================== */
/*
 * Feedback button + Google Form modal.
 * Injects a "Feedback" button immediately before the Download App shortcut
 * button (so it appears on its left) and opens the embedded Google Form in a
 * site-themed modal. Uses the official Google Forms embed iframe.
 */
(function () {
    "use strict";

    if (window.__jadhavFeedbackLoaded) return;
    window.__jadhavFeedbackLoaded = true;

    var BUTTON_ID = "feedbackBtn";
    var DIALOG_ID = "feedbackDialog";
    var ADD_SHORTCUT_ID = "addShortcutBtn";
    var FORM_SRC = "https://docs.google.com/forms/d/e/1FAIpQLSdhenKdL-kaeHNXhcbr2CvT4YhN2efU101GTEReNxI14Vy-2Q/viewform?embedded=true";

    var button = null;
    var dialog = null;
    var card = null;
    var frame = null;
    var loading = null;
    var lastFocus = null;
    var isOpen = false;
    var previousOverflow = "";
    var formRequested = false;
    var frameLoaded = false;
    var warmScheduled = false;
    var intentBound = false;

    var FEEDBACK_ICON =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
            '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8Z"/>' +
            '<path d="M8 11h8"/>' +
            '<path d="M8 14.5h5"/>' +
        '</svg>';

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
        var el = document.createElement("button");
        el.type = "button";
        el.id = BUTTON_ID;
        el.className = "feedback-btn";
        el.setAttribute("aria-label", "Open feedback form");
        el.setAttribute("aria-haspopup", "dialog");
        el.title = "Feedback";
        el.innerHTML = FEEDBACK_ICON + '<span class="feedback-label">Feedback</span>';
        el.addEventListener("click", openDialog);
        bindIntent(el);
        return el;
    }
// ==================================================
// FUNCTION: CREATE BUTTON END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS STATIC ONLY PAGE START
// This function performs the is static only page step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isStaticOnlyPage() {
        return !!(document.body && document.body.getAttribute("data-feedback-static-only") === "true");
    }
// ==================================================
// FUNCTION: IS STATIC ONLY PAGE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: BIND STATIC BUTTONS START
// This function performs the bind static buttons step of this calculator.
// This is where this function's work happens.
// ==================================================
    function bindStaticButtons() {
        var nodes = document.querySelectorAll(".feedback-btn[data-feedback-static=\"true\"]");
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (el.getAttribute("data-feedback-bound") === "true") continue;
            if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", "Open feedback form");
            el.setAttribute("aria-haspopup", "dialog");
            el.title = el.title || "Feedback";
            if (!el.querySelector(".feedback-label")) {
                el.innerHTML = FEEDBACK_ICON + '<span class="feedback-label">Feedback</span>';
            }
            el.addEventListener("click", openDialog);
            bindIntent(el);
            el.setAttribute("data-feedback-bound", "true");
        }
        return nodes.length > 0;
    }
// ==================================================
// FUNCTION: BIND STATIC BUTTONS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: FIND INSERT TARGET START
// This function performs the find insert target step of this calculator.
// This is where this function's work happens.
// ==================================================
    function findInsertTarget() {
        var shortcut = document.getElementById(ADD_SHORTCUT_ID);
        if (shortcut && shortcut.parentNode) {
            return { container: shortcut.parentNode, before: shortcut };
        }
        var context = getHeaderContext();
        if (context && context.container) {
            return { container: context.container, before: context.before || null };
        }
        return null;
    }
// ==================================================
// FUNCTION: FIND INSERT TARGET END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: PLACE BUTTON START
// This function performs the place button step of this calculator.
// This is where this function's work happens.
// ==================================================
    function placeButton() {
        if (!button) return;
        if (button.getAttribute("data-feedback-static") === "true") return;
        var target = findInsertTarget();
        if (!target || !target.container) return;

        // Keep Feedback immediately left of the Download App button when present.
        var shortcut = document.getElementById(ADD_SHORTCUT_ID);
        if (shortcut && shortcut.parentNode === target.container) {
            if (button.parentNode !== target.container || button.nextSibling !== shortcut) {
                target.container.insertBefore(button, shortcut);
            }
            return;
        }

        if (button.parentNode !== target.container) {
            if (target.before && target.before.parentNode === target.container) {
                target.container.insertBefore(button, target.before);
            } else {
                target.container.appendChild(button);
            }
        }
    }
// ==================================================
// FUNCTION: PLACE BUTTON END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ENSURE BUTTON START
// This function performs the ensure button step of this calculator.
// This is where this function's work happens.
// ==================================================
    function ensureButton() {
        if (isStaticOnlyPage()) {
            bindStaticButtons();
            return true;
        }
        if (document.getElementById(BUTTON_ID)) {
            button = document.getElementById(BUTTON_ID);
            if (button.getAttribute("data-feedback-intent") !== "true") {
                bindIntent(button);
            }
        }
        if (!button) {
            button = createButton();
        }
        placeButton();
        return !!(button && button.parentNode);
    }
// ==================================================
// FUNCTION: ENSURE BUTTON END
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
        dialog.className = "fb-dialog";
        dialog.id = DIALOG_ID;
        dialog.hidden = true;
        dialog.innerHTML =
            '<div class="fb-dialog__backdrop" data-fb-close aria-hidden="true"></div>' +
            '<section class="fb-dialog__card" role="dialog" aria-modal="true" ' +
            'aria-labelledby="fbDialogTitle" tabindex="-1">' +
                '<div class="fb-dialog__header">' +
                    '<h2 class="fb-dialog__title" id="fbDialogTitle">We Value Your Feedback</h2>' +
                '</div>' +
                '<button class="fb-dialog__close" type="button" aria-label="Close feedback form" data-fb-close>&times;</button>' +
                '<div class="fb-dialog__body">' +
                    '<div class="fb-dialog__loading" id="fbDialogLoading">' +
                        '<span class="fb-dialog__spinner" aria-hidden="true"></span>' +
                        '<span>Loading form…</span>' +
                    '</div>' +
                    '<iframe class="fb-dialog__frame" id="fbDialogFrame" title="Feedback form" ' +
                        'referrerpolicy="no-referrer-when-downgrade"></iframe>' +
                '</div>' +
            '</section>';

        document.body.appendChild(dialog);

        card = dialog.querySelector(".fb-dialog__card");
        frame = dialog.querySelector("#fbDialogFrame");
        loading = dialog.querySelector("#fbDialogLoading");

        dialog.addEventListener("click", function (event) {
            var target = event.target;
            if (target && target.closest && target.closest("[data-fb-close]")) {
                event.preventDefault();
                closeDialog();
            }
        });

        if (frame) {
            frame.addEventListener("load", function () {
                if (!frame.src) return;
                frameLoaded = true;
                if (loading) loading.hidden = true;
            });
        }

        document.addEventListener("keydown", onKeyDown, false);
    }
// ==================================================
// FUNCTION: BUILD DIALOG END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: WARM FORM START
// This function performs the warm form step of this calculator.
// Starts loading the embedded form before the panel is opened, so the form is
// already there when the Feedback button is clicked. It never blocks the page:
// the request is started at idle time or on the first sign of intent.
// ==================================================
    function warmForm() {
        if (!document.body) return;
        if (!dialog) buildDialog();
        if (!frame || formRequested) return;
        formRequested = true;
        frameLoaded = false;
        if (loading) loading.hidden = false;
        frame.src = FORM_SRC;
    }
// ==================================================
// FUNCTION: WARM FORM END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SCHEDULE WARM START
// Warms the form once, off the critical path: right after the page is idle, or
// on the first hover / focus / touch of a Feedback button (whichever is first).
// ==================================================
    function scheduleWarm() {
        if (warmScheduled) return;
        warmScheduled = true;

        // On a data saver / very slow connection the background download is not
        // worth it: the panel still opens instantly and shows its loading state.
        var conn = navigator.connection || navigator.mozConnection ||
            navigator.webkitConnection;
        if (conn && (conn.saveData ||
            conn.effectiveType === "slow-2g" ||
            conn.effectiveType === "2g" ||
            conn.effectiveType === "3g")) {
            return;
        }

        var warm = function () { warmForm(); };

        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(warm, { timeout: 3000 });
        } else {
            window.setTimeout(warm, 1500);
        }
    }
// ==================================================
// FUNCTION: SCHEDULE WARM END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: BIND INTENT START
// Starts the download on the way to the click, so a hover, keyboard focus or
// touch of the button removes the remaining waiting time.
// ==================================================
    function bindIntent(el) {
        if (!el || el.getAttribute("data-feedback-intent") === "true") return;
        el.setAttribute("data-feedback-intent", "true");
        var warm = function () { warmForm(); };
        el.addEventListener("pointerenter", warm, { passive: true });
        el.addEventListener("focusin", warm, { passive: true });
        el.addEventListener("touchstart", warm, { passive: true });
        el.addEventListener("mousedown", warm, { passive: true });
    }
// ==================================================
// FUNCTION: BIND INTENT END
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
// FUNCTION: OPEN DIALOG START
// This function performs the open dialog step of this calculator.
// This is where this function's work happens.
// ==================================================
    function openDialog() {
        if (!document.body) return;
        if (!dialog) buildDialog();
        if (!dialog || isOpen) {
            if (isOpen) focusElement(card);
            return;
        }

        isOpen = true;
        lastFocus = document.activeElement;
        previousOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";

        // The form is normally already warm. If not, start it now and show the
        // loading state only while the form is really still on its way.
        if (!frameLoaded) warmForm();
        if (loading) loading.hidden = frameLoaded;

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
        dialog.hidden = true;
        dialog.classList.remove("is-open");
        document.documentElement.style.overflow = previousOverflow || "";
        previousOverflow = "";

        if (lastFocus && typeof lastFocus.focus === "function") {
            try { lastFocus.focus({ preventScroll: true }); } catch (e) { try { lastFocus.focus(); } catch (e2) {} }
        } else if (button && typeof button.focus === "function") {
            try { button.focus({ preventScroll: true }); } catch (e) { try { button.focus(); } catch (e2) {} }
        }
        lastFocus = null;
    }
// ==================================================
// FUNCTION: CLOSE DIALOG END
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
            'button:not([disabled]), [href], iframe, [tabindex]:not([tabindex="-1"])'
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
// FUNCTION: OBSERVE PLACEMENT START
// This function performs the observe placement step of this calculator.
// This is where this function's work happens.
// ==================================================
    function observePlacement() {
        if (isStaticOnlyPage()) return;
        if (typeof MutationObserver === "undefined") return;

        var reinserting = false;
        var schedule = function () {
            if (reinserting) return;
            reinserting = true;
            window.setTimeout(function () {
                reinserting = false;
                ensureButton();
            }, 0);
        };

        var obs = new MutationObserver(schedule);

        var header = document.querySelector("header.header") || document.querySelector("header.app-header .app-header-inner");
        if (header) {
            obs.observe(header, { childList: true, subtree: true });
        }
        obs.observe(document.body, { childList: true, subtree: false });

        // Keep observing; header actions may be regrouped after initial load.
        window.setTimeout(schedule, 50);
        window.setTimeout(schedule, 500);
        window.setTimeout(schedule, 2000);
    }
// ==================================================
// FUNCTION: OBSERVE PLACEMENT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: INIT START
// This function performs the init step of this calculator.
// This is where this function's work happens.
// ==================================================
    function init() {
        if (isStaticOnlyPage()) {
            bindStaticButtons();
            buildDialog();
            scheduleWarm();
            return;
        }
        ensureButton();
        // In-page Feedback buttons (e.g. at the bottom of the About Us page)
        // share the same dialog as the header button.
        bindStaticButtons();
        observePlacement();
        // Build the panel once, up front, so a click only has to show it, and
        // warm the embedded form in the background while the page is idle.
        buildDialog();
        scheduleWarm();
    }
// ==================================================
// FUNCTION: INIT END
// This function ends here.
// ==================================================

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();

/* ==================================================
   FEEDBACK DIALOG JAVASCRIPT END
   This JavaScript file ends here.
================================================== */