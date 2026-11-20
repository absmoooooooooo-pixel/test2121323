/* ==================================================
   NUMERIC KEYPAD JAVASCRIPT START
   In-page numeric keyboard for phones and tablets.

   HOW IT WORKS
   ------------
   The page checks the pointing device, not the window width:
   a phone or tablet reports a coarse pointer with no fine pointer,
   while a PC or laptop always has a fine pointer (mouse, trackpad).
   On a PC this file does nothing at all - the field keeps its real
   number input and the physical keyboard works exactly as before.

   On a phone/tablet every numeric field is switched to
   inputmode="none" so the Android or iPhone keyboard never opens,
   and tapping the field shows the keypad built below.

   A number input refuses to hold a trailing decimal point
   ("0." is not a valid number), which would break decimal entry
   from a keypad. On mobile only, those fields therefore become
   text fields that keep the same look and still expose .value to
   the calculator, so 0.5 can be typed digit by digit.
================================================== */
"use strict";

(function () {
    const coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)") : null;
    const fine = window.matchMedia ? window.matchMedia("(any-pointer: fine)") : null;

    let panel = null;
    let activeField = null;
    let started = false;
    let observer = null;

    /* A phone or tablet has a coarse pointer only. A PC or laptop always has
       a fine pointer, so touch-screen laptops never show the keypad. */
    function isMobileDevice() {
        if (!coarse || !fine) {
            return false;
        }

        return coarse.matches && !fine.matches;
    }

    function numericFields() {
        return Array.prototype.slice.call(document.querySelectorAll("input.nk-field"))
            .filter(function (field) {
                return !field.disabled && !field.readOnly && field.getClientRects().length > 0;
            });
    }

    /* Sets one field up for the keypad. Only types that currently hold a
       number are touched, and the work is done once per field. */
    function prepareField(field) {
        if (!field || field.classList.contains("nk-field") || field.type !== "number") {
            return;
        }

        field.setAttribute("data-nk-original-type", "number");
        field.type = "text";
        field.setAttribute("inputmode", "none");
        field.setAttribute("autocomplete", "off");
        field.setAttribute("autocorrect", "off");
        field.setAttribute("autocapitalize", "off");
        field.setAttribute("spellcheck", "false");
        field.classList.add("nk-field");
    }

    function prepareAll(root) {
        const scope = root && root.querySelectorAll ? root : document;

        if (root && root.matches && root.matches("input")) {
            prepareField(root);
        }

        Array.prototype.forEach.call(scope.querySelectorAll("input"), prepareField);
    }

    function buildPanel() {
        panel = document.createElement("div");
        panel.className = "nk-panel";
        panel.id = "numericKeypad";
        panel.setAttribute("role", "group");
        panel.setAttribute("aria-label", "Numeric keypad");
        panel.setAttribute("aria-hidden", "true");
        panel.innerHTML =
            '<div class="nk-grid">' +
                '<button class="nk-key" type="button" data-nk="1">1</button>' +
                '<button class="nk-key" type="button" data-nk="2">2</button>' +
                '<button class="nk-key" type="button" data-nk="3">3</button>' +
                '<button class="nk-key nk-key--special" type="button" data-nk="backspace" aria-label="Backspace">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
                    '<path d="M8.6 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.6L2.4 12l6.2-7Z"/>' +
                    '<path d="m12.2 9.4 5.2 5.2M17.4 9.4l-5.2 5.2"/></svg>' +
                '</button>' +
                '<button class="nk-key" type="button" data-nk="4">4</button>' +
                '<button class="nk-key" type="button" data-nk="5">5</button>' +
                '<button class="nk-key" type="button" data-nk="6">6</button>' +
                '<button class="nk-key nk-key--next" type="button" data-nk="next">Next</button>' +
                '<button class="nk-key" type="button" data-nk="7">7</button>' +
                '<button class="nk-key" type="button" data-nk="8">8</button>' +
                '<button class="nk-key" type="button" data-nk="9">9</button>' +
                '<button class="nk-key nk-key--special" type="button" data-nk="." aria-label="Decimal point">.</button>' +
                '<button class="nk-key nk-key--empty" type="button" tabindex="-1" aria-hidden="true" disabled></button>' +
                '<button class="nk-key" type="button" data-nk="0">0</button>' +
                '<button class="nk-key nk-key--empty" type="button" tabindex="-1" aria-hidden="true" disabled></button>' +
                '<button class="nk-key nk-key--empty" type="button" tabindex="-1" aria-hidden="true" disabled></button>' +
            '</div>';

        /* pointerdown, not click: preventing the default keeps focus and the
           caret in the field while a key is pressed. */
        panel.addEventListener("pointerdown", function (event) {
            const key = event.target.closest("[data-nk]");

            event.preventDefault();

            if (!key || !activeField) {
                return;
            }

            const value = key.getAttribute("data-nk");

            if (value === "next") {
                goToNextField();
            } else {
                applyKey(value);
            }
        });

        /* A tap already ran on pointerdown, so only keyboard activation
           (Enter or Space, which reports detail 0) is handled here. */
        panel.addEventListener("click", function (event) {
            const key = event.target.closest("[data-nk]");

            if (!key || !activeField || event.detail !== 0) {
                return;
            }

            const value = key.getAttribute("data-nk");

            if (value === "next") {
                goToNextField();
            } else {
                applyKey(value);
            }
        });

        document.body.appendChild(panel);
    }

    function emitInput(field) {
        field.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function caretOf(field) {
        const position = field.selectionStart;
        return position === null || position === undefined ? field.value.length : position;
    }

    function applyKey(key) {
        const field = activeField;

        if (!field) {
            return;
        }

        let value = field.value;
        let start = caretOf(field);
        let end = field.selectionEnd === null || field.selectionEnd === undefined ?
            start : field.selectionEnd;

        if (key === "backspace") {
            if (start !== end) {
                value = value.slice(0, start) + value.slice(end);
            } else if (start > 0) {
                value = value.slice(0, start - 1) + value.slice(start);
                start -= 1;
            } else {
                return;
            }
        } else if (key === ".") {
            if (value.indexOf(".") !== -1) {
                return;
            }

            if (/[0-9]/.test(value.slice(0, start))) {
                value = value.slice(0, start) + "." + value.slice(end);
                start += 1;
            } else {
                value = value.slice(0, start) + "0." + value.slice(end);
                start += 2;
            }
        } else if (value === "0" && start === 1 && end === 1) {
            /* A leading zero is replaced by the first digit pressed. */
            value = key;
        } else {
            value = value.slice(0, start) + key + value.slice(end);
            start += 1;
        }

        field.value = value;

        try {
            field.setSelectionRange(start, start);
        } catch (error) {
            /* Some inputs do not support selection; the value is still set. */
        }

        emitInput(field);
    }

    function scrollFieldIntoView(field) {
        if (!panel) {
            return;
        }

        const rect = field.getBoundingClientRect();
        const topLimit = 96;
        const bottomLimit = window.innerHeight - panel.offsetHeight - 18;

        if (rect.top < topLimit) {
            window.scrollBy({ top: rect.top - topLimit - 24, behavior: "smooth" });
        } else if (rect.bottom > bottomLimit) {
            window.scrollBy({ top: rect.bottom - bottomLimit + 24, behavior: "smooth" });
        }
    }

    function openKeypad(field) {
        if (!panel) {
            buildPanel();
        }

        if (activeField && activeField !== field) {
            activeField.classList.remove("nk-active");
        }

        activeField = field;
        field.classList.add("nk-active");
        panel.classList.add("is-open");
        panel.setAttribute("aria-hidden", "false");
        scrollFieldIntoView(field);
    }

    function closeKeypad() {
        const field = activeField;

        activeField = null;

        if (panel) {
            panel.classList.remove("is-open");
            panel.setAttribute("aria-hidden", "true");
        }

        if (field) {
            field.classList.remove("nk-active");

            /* A half-typed decimal is tidied up when the entry finishes. */
            if (/\.$/.test(field.value)) {
                field.value = field.value.replace(/\.$/, "");
                emitInput(field);
            }

            /* The page learns the finished value here, exactly as it would
               after a native keyboard was dismissed. */
            field.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function goToNextField() {
        const fields = numericFields();
        const index = fields.indexOf(activeField);

        if (index === -1) {
            return;
        }

        if (index >= fields.length - 1) {
            /* Last numeric field: the entry is complete. */
            const last = fields[index];

            closeKeypad();
            last.blur();
            return;
        }

        fields[index + 1].focus();
    }

    function onFocusIn(event) {
        const field = event.target;

        if (!field || !field.classList || !field.classList.contains("nk-field")) {
            return;
        }

        openKeypad(field);
    }

    function onPointerDown(event) {
        if (!panel) {
            return;
        }

        const target = event.target;
        const field = target.closest ? target.closest("input.nk-field") : null;

        if (field) {
            /* Tapping the field opens the keypad even when it already has
               focus, which a second tap on the same field does not report. */
            if (!panel.classList.contains("is-open") || activeField !== field) {
                openKeypad(field);
            }

            return;
        }

        if (panel && panel.classList.contains("is-open") && !panel.contains(target)) {
            closeKeypad();
        }
    }

    function start() {
        if (started || !isMobileDevice()) {
            return;
        }

        started = true;
        prepareAll(document);
        buildPanel();

        document.addEventListener("focusin", onFocusIn, true);
        document.addEventListener("pointerdown", onPointerDown, true);

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && panel && panel.classList.contains("is-open")) {
                closeKeypad();
            }
        });

        /* Products such as the nut and bolt page build their fields after the
           page loads, so every new numeric input is prepared as it appears. */
        if (window.MutationObserver) {
            observer = new MutationObserver(function (records) {
                records.forEach(function (record) {
                    Array.prototype.forEach.call(record.addedNodes, function (node) {
                        if (node.nodeType === 1) {
                            prepareAll(node);
                        }
                    });
                });
            });

            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    /* Small public hook: pages and tests can initialise the keypad on demand. */
    window.NumericKeypad = { start: start, isMobileDevice: isMobileDevice };

    start();
})();

/* ==================================================
   NUMERIC KEYPAD JAVASCRIPT END
================================================== */
