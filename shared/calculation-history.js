/* ==================================================
   CALCULATION HISTORY JAVASCRIPT START
   Stores and lists the calculations saved on this device.
   Here is the logic for saving and showing the history.
================================================== */
/*
 * Shared calculation history.
 *
 * Records are kept in sessionStorage under a storage key that is unique to
 * each calculator. sessionStorage survives navigation between pages in the
 * same tab, so returning to a calculator restores its history exactly, but
 * each calculator only ever reads and writes its own key.
 *
 * A full page reload (or closing and reopening the site) starts with empty
 * history. History is also removed when the user presses Clear History.
 */
(function () {
    "use strict";

    var STORAGE_PREFIX = "jadhav-engineering:calculation-history:v1:";
    var storage = null;

    try {
        storage = window.sessionStorage;
        var storageTestKey = STORAGE_PREFIX + "__storage-test__";
        storage.setItem(storageTestKey, "1");
        storage.removeItem(storageTestKey);
    } catch (error) {
        storage = null;
    }

// ==================================================
// FUNCTION: GET NAVIGATION TYPE START
// This function performs the get navigation type step of this calculator.
// This is where this function's work happens.
// ==================================================
    function getNavigationType() {
        try {
            var entries = window.performance &&
                typeof window.performance.getEntriesByType === "function"
                ? window.performance.getEntriesByType("navigation")
                : [];

            if (entries && entries.length && entries[0].type) {
                return entries[0].type;
            }
        } catch (error) {
            // Fall through to the legacy API below.
        }

        try {
            if (window.performance && window.performance.navigation) {
                if (window.performance.navigation.type === 1) {
                    return "reload";
                }
            }
        } catch (error) {
            // Treat the navigation type as unknown.
        }

        return "";
    }
// ==================================================
// FUNCTION: GET NAVIGATION TYPE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CLEAR PERSISTED HISTORY START
// This function performs the clear persisted history step of this calculator.
// This is where this function's work happens.
// ==================================================
    function clearPersistedHistory() {
        if (!storage) {
            return;
        }

        try {
            var keysToRemove = [];

            for (var index = 0; index < storage.length; index += 1) {
                var key = storage.key(index);

                if (key && key.indexOf(STORAGE_PREFIX) === 0) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach(function (key) {
                storage.removeItem(key);
            });
        } catch (error) {
            // Storage can be unavailable; the in-memory history still works.
        }
    }
// ==================================================
// FUNCTION: CLEAR PERSISTED HISTORY END
// This function ends here.
// ==================================================

    // Reloading the website clears all calculator histories. This only runs
    // on a genuine reload, never on ordinary navigation between pages.
    if (getNavigationType() === "reload") {
        clearPersistedHistory();
    }

    var config = window.CALCULATOR_HISTORY_CONFIG;

    if (!config) {
        return;
    }

// ==================================================
// FUNCTION: GET STORAGE KEY START
// This function performs the get storage key step of this calculator.
// This is where this function's work happens.
// ==================================================
    function getStorageKey() {
        if (config.historyKey) {
            return STORAGE_PREFIX + String(config.historyKey).trim();
        }

        // Every calculator has its own name, so the name is a stable and
        // completely separate storage key for its history.
        return STORAGE_PREFIX + String(
            config.calculatorName || getCalculatorName()
        ).trim();
    }
// ==================================================
// FUNCTION: GET STORAGE KEY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: IS VALID STORED RECORD START
// This function performs the is valid stored record step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isValidStoredRecord(record) {
        return Boolean(
            record &&
            typeof record === "object" &&
            Array.isArray(record.dimensions) &&
            record.dimensions.length &&
            Number.isFinite(Number(record.unitWeight)) &&
            Number.isFinite(Number(record.totalWeight)) &&
            Number.isFinite(Number(record.timestamp))
        );
    }
// ==================================================
// FUNCTION: IS VALID STORED RECORD END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: LOAD STORED RECORDS START
// This function performs the load stored records step of this calculator.
// This is where this function's work happens.
// ==================================================
    function loadStoredRecords() {
        if (!storage) {
            return [];
        }

        try {
            var storedValue = storage.getItem(getStorageKey());

            if (!storedValue) {
                return [];
            }

            var parsed = JSON.parse(storedValue);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter(isValidStoredRecord);
        } catch (error) {
            return [];
        }
    }
// ==================================================
// FUNCTION: LOAD STORED RECORDS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: PERSIST RECORDS START
// This function performs the persist records step of this calculator.
// This is where this function's work happens.
// ==================================================
    function persistRecords() {
        if (!storage) {
            return;
        }

        try {
            if (!records.length) {
                storage.removeItem(getStorageKey());
                return;
            }

            storage.setItem(getStorageKey(), JSON.stringify(records));
        } catch (error) {
            // Keep the in-memory history usable even if storage is full.
        }
    }
// ==================================================
// FUNCTION: PERSIST RECORDS END
// This function ends here.
// ==================================================

    var records = [];
    var lastRecordedSignature = null;
    var historyButton = null;
    var historyPanel = null;
    var historyOverlay = null;
    var historyList = null;
    var historySubtitle = null;
    var historyCount = null;
    var clearButton = null;
    var closeButton = null;
    var previouslyFocused = null;

    var dateFormatter = null;

    try {
        dateFormatter = new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    } catch (error) {
        dateFormatter = null;
    }

    var ESCAPE_MAP = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

// ==================================================
// FUNCTION: ESCAPE HTML START
// This function performs the escape html step of this calculator.
// This is where this function's work happens.
// ==================================================
    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return ESCAPE_MAP[character];
        });
    }
// ==================================================
// FUNCTION: ESCAPE HTML END
// This function ends here.
// ==================================================

// ==================================================
// DIMENSION FORMATTING HELPER START
// Turns a dimension value into the short text used in the diagram labels.
// Here the value of the dimension is formatted.
// ==================================================
    function formatDimension(value) {
        var number = Number(value);

        if (!Number.isFinite(number)) {
            return String(value);
        }

        return number.toLocaleString("en-IN", {
            maximumFractionDigits: 4
        });
    }
// ==================================================
// DIMENSION FORMATTING HELPER END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: FORMAT WEIGHT START
// This function performs the format weight step of this calculator.
// This is where this function's work happens.
// ==================================================
    function formatWeight(value) {
        var number = Number(value);

        if (!Number.isFinite(number)) {
            return "0.00";
        }

        return number.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 3
        });
    }
// ==================================================
// FUNCTION: FORMAT WEIGHT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: FORMAT DENSITY START
// This function performs the format density step of this calculator.
// This is where this function's work happens.
// ==================================================
    function formatDensity(value, unit) {
        var number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        /* kg/m³ values are whole thousands; g/cm³ values need decimals. */
        if (unit === "kg/m³") {
            return number.toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
        }

        return number.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        });
    }
// ==================================================
// FUNCTION: FORMAT DENSITY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: FORMAT TIMESTAMP START
// This function performs the format timestamp step of this calculator.
// This is where this function's work happens.
// ==================================================
    function formatTimestamp(timestamp) {
        try {
            if (dateFormatter) {
                return dateFormatter.format(new Date(timestamp));
            }
        } catch (error) {
            // Fall through to the browser's default formatter.
        }

        return new Date(timestamp).toLocaleString();
    }
// ==================================================
// FUNCTION: FORMAT TIMESTAMP END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: GET CALCULATOR NAME START
// This function performs the get calculator name step of this calculator.
// This is where this function's work happens.
// ==================================================
    function getCalculatorName() {
        if (config.calculatorName) {
            return config.calculatorName;
        }

        var heading = document.querySelector("h1");
        return heading ? heading.textContent.trim() : "Weight Calculator";
    }
// ==================================================
// FUNCTION: GET CALCULATOR NAME END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: GET SHORT SHAPE NAME START
// This function performs the get short shape name step of this calculator.
// This is where this function's work happens.
// ==================================================
    function getShortShapeName() {
        var name = "";

        if (config.shapeName) {
            /* A page with several shapes (the dish-end family) can compute
               the name from its current type instead of using one fixed
               label for every record. */
            name = String(
                typeof config.shapeName === "function"
                    ? config.shapeName()
                    : config.shapeName
            ).trim();
        }

        if (!name) {
            name = getCalculatorName();
        }

        // A history card must only show the shape. If a page accidentally
        // supplies the full page title, strip the calculator suffix here so
        // "Weight Calculator" can never leak into the card heading.
        return name
            .replace(/\s+Weight\s+Calculator\s*$/i, "")
            .replace(/\s+Calculator\s*$/i, "")
            .trim() || "Shape";
    }
// ==================================================
// FUNCTION: GET SHORT SHAPE NAME END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: GET MATERIAL KEY START
// This function performs the get material key step of this calculator.
// This is where this function's work happens.
// ==================================================
    function getMaterialKey() {
        var select = document.getElementById("material");

        return select ? String(select.value || "").trim() : "";
    }
// ==================================================
// FUNCTION: GET MATERIAL KEY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: READ DIMENSION START
// This function performs the read dimension step of this calculator.
// This is where this function's work happens.
// ==================================================
    function readDimension(calculation, key) {
        if (
            calculation.values &&
            Object.prototype.hasOwnProperty.call(calculation.values, key)
        ) {
            return calculation.values[key];
        }

        return calculation[key];
    }
// ==================================================
// FUNCTION: READ DIMENSION END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: NORMALIZE SIGNATURE VALUE START
// This function performs the normalize signature value step of this calculator.
// This is where this function's work happens.
// ==================================================
    function normalizeSignatureValue(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === "string" && value.trim() === "") {
            return "";
        }

        var number = Number(value);

        if (Number.isFinite(number)) {
            return number;
        }

        return String(value).trim();
    }
// ==================================================
// FUNCTION: NORMALIZE SIGNATURE VALUE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: BUILD SIGNATURE START
// This function performs the build signature step of this calculator.
// This is where this function's work happens.
// ==================================================
    function buildSignature(calculation) {
        var unit = String(calculation.unit || "").trim();
        var configuredDimensions = config.dimensions || [];

        // Include every configured dimension, even when a value is missing,
        // so two different input states can never collapse into one
        // signature. The signature is based on the entered inputs, not on
        // the rounded weight shown in the card.
        return JSON.stringify({
            version: 1,
            calculator: String(
                config.calculatorName || getCalculatorName()
            ).trim(),
            shape: getShortShapeName(),
            dimensions: configuredDimensions.map(function (field) {
                return [
                    field.key,
                    normalizeSignatureValue(
                        readDimension(calculation, field.key)
                    ),
                    unit
                ];
            }),
            unit: unit,
            materialKey: getMaterialKey(),
            material: String(calculation.materialName || "").trim(),
            density: normalizeSignatureValue(calculation.density),
            quantity: normalizeSignatureValue(calculation.quantity)
        });
    }
// ==================================================
// FUNCTION: BUILD SIGNATURE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: BUILD RECORD START
// This function performs the build record step of this calculator.
// This is where this function's work happens.
// ==================================================
    function buildRecord() {
        if (typeof config.getCalculation !== "function") {
            return null;
        }

        var calculation = config.getCalculation();

        if (!calculation) {
            return null;
        }

        if (
            !Number.isFinite(Number(calculation.singleWeight)) ||
            !Number.isFinite(Number(calculation.totalWeight))
        ) {
            return null;
        }

        var dimensions = (config.dimensions || []).map(function (field) {
            return {
                key: field.key,
                label: field.label,
                value: readDimension(calculation, field.key),
                // A count (for example a bolt hole number) carries no
                // length unit; a config opts out with unit: false.
                unit: field.unit === false ? "" : (calculation.unit || "")
            };
        }).filter(function (field) {
            return field.value !== undefined &&
                field.value !== null &&
                field.value !== "" &&
                Number.isFinite(Number(field.value));
        });

        if (!dimensions.length) {
            return null;
        }

        return {
            calculatorName: getCalculatorName(),
            shapeName: getShortShapeName(),
            signature: buildSignature(calculation),
            timestamp: Date.now(),
            dimensions: dimensions,
            material: calculation.materialName || "Unknown material",
            density: calculation.density,
            densityUnit: calculation.densityUnit || "g/cm³",
            quantity: calculation.quantity,
            unitWeight: calculation.singleWeight,
            totalWeight: calculation.totalWeight,
            weightUnit: "kg"
        };
    }
// ==================================================
// FUNCTION: BUILD RECORD END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: UPDATE SUMMARY START
// This function performs the update summary step of this calculator.
// This is where this function's work happens.
// ==================================================
    function updateSummary() {
        var count = records.length;
        var noun = count === 1 ? "calculation" : "calculations";

        if (historyCount) {
            historyCount.textContent = String(count);
            historyCount.hidden = count === 0;
        }

        if (historyButton) {
            historyButton.setAttribute(
                "aria-label",
                count === 0
                    ? "Open calculation history"
                    : "Open calculation history, " + count + " " + noun
            );
        }

        if (historySubtitle) {
            historySubtitle.textContent = count === 0
                ? "No calculations yet for this calculator."
                : count + " " + noun + " saved for this calculator.";
        }

        if (clearButton) {
            clearButton.disabled = count === 0;
        }
    }
// ==================================================
// FUNCTION: UPDATE SUMMARY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: FORMAT SIZE VALUE START
// This function performs the format size value step of this calculator.
// This is where this function's work happens.
// ==================================================
    function formatSizeValue(value) {
        var number = Number(value);

        if (!Number.isFinite(number)) {
            return String(value);
        }

        return number.toLocaleString("en-IN", {
            useGrouping: false,
            maximumFractionDigits: 4
        });
    }
// ==================================================
// FUNCTION: FORMAT SIZE VALUE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: GET SIZE TOKEN START
// This function performs the get size token step of this calculator.
// This is where this function's work happens.
// ==================================================
    function getSizeToken(field) {
        var match = /\(([^)]+)\)\s*$/.exec(field.label || "");
        return match ? match[1] : "";
    }
// ==================================================
// FUNCTION: GET SIZE TOKEN END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: FORMAT SIZE START
// This function performs the format size step of this calculator.
// This is where this function's work happens.
// ==================================================
    function formatSize(record) {
        var unit = record.dimensions.length
            ? record.dimensions[0].unit
            : "";
        var parts = record.dimensions.map(function (field) {
            var value = formatSizeValue(field.value);
            var token = config.sizeLabels === true
                ? getSizeToken(field)
                : "";

            return token ? token + " " + value : value;
        });

        return "Size: " + parts.join(" × ") + (unit ? " " + unit : "");
    }
// ==================================================
// FUNCTION: FORMAT SIZE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RENDER RECORD START
// This function performs the render record step of this calculator.
// This is where this function's work happens.
// ==================================================
    function renderRecord(record) {
        var dimensionItems = record.dimensions.map(function (field) {
            return [
                "<div>",
                "<dt>", escapeHtml(field.label), "</dt>",
                "<dd>",
                escapeHtml(formatDimension(field.value)),
                " ",
                escapeHtml(field.unit),
                "</dd>",
                "</div>"
            ].join("");
        }).join("");

        var quantity = Number(record.quantity);
        var quantityText = formatDimension(quantity) +
            (quantity === 1 ? " pc" : " pcs");
        var sizeText = formatSize(record);

        return [
            '<details class="history-record">',
            '<summary class="history-record-summary">',
            '<span class="history-record-main">',
            '<span class="history-record-name">',
            escapeHtml(record.shapeName),
            "</span>",
            '<span class="history-record-line">',
            '<span class="history-record-size">',
            escapeHtml(sizeText),
            "</span>",
            '<span class="history-record-weight">Weight: ',
            escapeHtml(formatWeight(record.totalWeight)),
            " ",
            escapeHtml(record.weightUnit),
            "</span>",
            "</span>",
            "</span>",
            '<span class="history-record-chevron" aria-hidden="true">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ',
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            '<path d="m6 9 6 6 6-6"/>',
            "</svg>",
            "</span>",
            "</summary>",
            '<div class="history-record-body">',
            '<p class="history-section-title">Dimensions</p>',
            '<dl class="history-dimensions">',
            dimensionItems,
            "</dl>",
            '<dl class="history-meta">',
            "<div><dt>Date &amp; Time</dt><dd>",
            escapeHtml(formatTimestamp(record.timestamp)),
            "</dd></div>",
            "<div><dt>Material</dt><dd>",
            escapeHtml(record.material),
            "</dd></div>",
            "<div><dt>Density</dt><dd>",
            escapeHtml(formatDensity(record.density, record.densityUnit)),
            " ",
            escapeHtml(record.densityUnit || "g/cm³"),
            "</dd></div>",
            "<div><dt>Quantity</dt><dd>",
            escapeHtml(quantityText),
            "</dd></div>",
            "<div><dt>Weight per Piece</dt><dd>",
            escapeHtml(formatWeight(record.unitWeight)),
            " ",
            escapeHtml(record.weightUnit),
            "</dd></div>",
            "<div><dt>Total Weight</dt><dd>",
            escapeHtml(formatWeight(record.totalWeight)),
            " ",
            escapeHtml(record.weightUnit),
            "</dd></div>",
            "</dl>",
            "</div>",
            "</details>"
        ].join("");
    }
// ==================================================
// FUNCTION: RENDER RECORD END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RENDER HISTORY START
// This function performs the render history step of this calculator.
// This is where this function's work happens.
// ==================================================
    function renderHistory() {
        if (!historyList) {
            return;
        }

        if (!records.length) {
            historyList.innerHTML = [
                '<div class="history-empty">',
                '<span class="history-empty-icon" aria-hidden="true">',
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ',
                'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">',
                '<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/>',
                '<path d="M3 3v5h5"/>',
                '<path d="M12 7v5l3 2"/>',
                "</svg>",
                "</span>",
                "<strong>No calculations yet.</strong>",
                "<span>Run a calculation and it will appear here.</span>",
                "</div>"
            ].join("");

            updateSummary();
            return;
        }

        historyList.innerHTML = records.map(renderRecord).join("");
        updateSummary();
    }
// ==================================================
// FUNCTION: RENDER HISTORY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ADD CURRENT CALCULATION START
// This function performs the add current calculation step of this calculator.
// This is where this function's work happens.
// ==================================================
    function addCurrentCalculation() {
        /*
         * The calculator's click handler is async: it starts the API request
         * and only writes its lastCalculation after the response arrives. This
         * listener runs immediately after that handler, so wait for the same
         * request before reading the result. Without this, the first click
         * records nothing and every later click records the previous result.
         */
        if (window.MWCalc &&
            typeof window.MWCalc.getLastCalculationPromise === "function") {
            var calculation = window.MWCalc.getLastCalculationPromise();

            if (!calculation) {
                return;
            }

            calculation.then(function () {
                window.setTimeout(addCurrentRecord, 0);
            }, function () {
                /* A failed calculation has no result to save. */
            });
            return;
        }

        addCurrentRecord();
    }

    function addCurrentRecord() {
        var record = buildRecord();

        if (!record) {
            return;
        }

        // Compare against the last successfully recorded calculation, not
        // every record in the session. Re-clicking Calculate with unchanged
        // inputs must leave the existing record untouched. Changing an input
        // and then changing it back is a new calculation because the last
        // recorded signature is now the intermediate input state.
        if (record.signature === lastRecordedSignature) {
            return;
        }

        lastRecordedSignature = record.signature;
        records.unshift(record);
        persistRecords();
        renderHistory();
    }
// ==================================================
// FUNCTION: ADD CURRENT CALCULATION END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: OPEN HISTORY START
// This function performs the open history step of this calculator.
// This is where this function's work happens.
// ==================================================
    function openHistory() {
        if (!historyPanel || !historyButton) {
            return;
        }

        previouslyFocused = document.activeElement;

        historyPanel.classList.add("is-open");
        historyOverlay.classList.add("is-open");
        historyPanel.removeAttribute("inert");
        historyPanel.setAttribute("aria-hidden", "false");
        historyOverlay.setAttribute("aria-hidden", "false");
        historyButton.setAttribute("aria-expanded", "true");
        document.body.classList.add("history-open");

        window.setTimeout(function () {
            if (
                closeButton &&
                historyPanel.classList.contains("is-open")
            ) {
                closeButton.focus();
            }
        }, 0);
    }
// ==================================================
// FUNCTION: OPEN HISTORY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CLOSE HISTORY START
// This function performs the close history step of this calculator.
// This is where this function's work happens.
// ==================================================
    function closeHistory() {
        if (!historyPanel || !historyButton) {
            return;
        }

        historyPanel.classList.remove("is-open");
        historyOverlay.classList.remove("is-open");
        historyPanel.setAttribute("inert", "");
        historyPanel.setAttribute("aria-hidden", "true");
        historyOverlay.setAttribute("aria-hidden", "true");
        historyButton.setAttribute("aria-expanded", "false");
        document.body.classList.remove("history-open");

        if (
            previouslyFocused &&
            typeof previouslyFocused.focus === "function"
        ) {
            previouslyFocused.focus();
        }
    }
// ==================================================
// FUNCTION: CLOSE HISTORY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CLEAR HISTORY START
// This function performs the clear history step of this calculator.
// This is where this function's work happens.
// ==================================================
    function clearHistory() {
        records.length = 0;
        lastRecordedSignature = null;
        persistRecords();
        renderHistory();

        if (closeButton && historyPanel &&
            historyPanel.classList.contains("is-open")) {
            closeButton.focus();
        } else if (historyButton) {
            historyButton.focus();
        }
    }
// ==================================================
// FUNCTION: CLEAR HISTORY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: TRAP FOCUS START
// This function performs the trap focus step of this calculator.
// This is where this function's work happens.
// ==================================================
    function trapFocus(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            closeHistory();
            return;
        }

        if (event.key !== "Tab" || !historyPanel) {
            return;
        }

        var focusable = Array.prototype.slice.call(
            historyPanel.querySelectorAll(
                'button:not([disabled]), summary, a[href], input, select, ' +
                'textarea, [tabindex]:not([tabindex="-1"])'
            )
        ).filter(function (element) {
            return element.offsetParent !== null;
        });

        if (!focusable.length) {
            return;
        }

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
// FUNCTION: TRAP FOCUS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CREATE HISTORY BUTTON START
// This function performs the create history button step of this calculator.
// This is where this function's work happens.
// ==================================================
    function createHistoryButton(header) {
        historyButton = document.createElement("button");
        historyButton.type = "button";
        historyButton.id = "historyBtn";
        historyButton.className = "history-trigger";
        historyButton.setAttribute("aria-haspopup", "dialog");
        historyButton.setAttribute("aria-controls", "historyPanel");
        historyButton.setAttribute("aria-expanded", "false");
        historyButton.setAttribute("aria-label", "Open calculation history");
        historyButton.innerHTML = [
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ',
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ',
            'aria-hidden="true" focusable="false">',
            '<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/>',
            '<path d="M3 3v5h5"/>',
            '<path d="M12 7v5l3 2"/>',
            "</svg>",
            '<span class="history-trigger-label">History</span>',
            '<span class="history-count" id="historyCount" hidden>0</span>'
        ].join("");

        header.appendChild(historyButton);
        historyCount = document.getElementById("historyCount");
        var group = header.querySelector(".header-actions-group");
        if (!group) {
            group = document.createElement("div");
            group.className = "header-actions-group";
            header.appendChild(group);
        }
        var order = [".add-shortcut-btn", ".home-pill", ".history-trigger"];
        order.forEach(function (sel) {
            var el = header.querySelector(sel);
            if (el) group.appendChild(el);
        });
    }
// ==================================================
// FUNCTION: CREATE HISTORY BUTTON END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CREATE HISTORY PANEL START
// This function performs the create history panel step of this calculator.
// This is where this function's work happens.
// ==================================================
    function createHistoryPanel() {
        historyOverlay = document.createElement("div");
        historyOverlay.className = "history-overlay";
        historyOverlay.id = "historyOverlay";
        historyOverlay.setAttribute("aria-hidden", "true");

        historyPanel = document.createElement("aside");
        historyPanel.className = "history-panel";
        historyPanel.id = "historyPanel";
        historyPanel.setAttribute("role", "dialog");
        historyPanel.setAttribute("aria-modal", "true");
        historyPanel.setAttribute("aria-labelledby", "historyTitle");
        historyPanel.setAttribute("aria-hidden", "true");
        historyPanel.setAttribute("inert", "");
        historyPanel.innerHTML = [
            '<div class="history-panel-header">',
            '<div class="history-panel-heading">',
            '<p class="history-eyebrow">Saved for this calculator</p>',
            '<h2 id="historyTitle">Calculation History</h2>',
            '<p class="history-subtitle" id="historySubtitle">',
            "No calculations yet for this calculator.",
            "</p>",
            "</div>",
            '<button class="history-close" type="button" ',
            'aria-label="Close calculation history">',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ',
            'stroke-width="2" stroke-linecap="round" aria-hidden="true" ',
            'focusable="false"><path d="M18 6 6 18M6 6l12 12"/></svg>',
            "</button>",
            "</div>",
            '<div class="history-list" id="historyList" aria-live="polite"></div>',
            '<div class="history-footer">',
            '<button class="history-clear" id="clearHistoryBtn" type="button" ',
            'disabled>Clear History</button>',
            "</div>"
        ].join("");

        document.body.appendChild(historyOverlay);
        document.body.appendChild(historyPanel);

        historyList = document.getElementById("historyList");
        historySubtitle = document.getElementById("historySubtitle");
        clearButton = document.getElementById("clearHistoryBtn");
        closeButton = historyPanel.querySelector(".history-close");
    }
// ==================================================
// FUNCTION: CREATE HISTORY PANEL END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: BIND EVENTS START
// This function performs the bind events step of this calculator.
// This is where this function's work happens.
// ==================================================
    function bindEvents() {
        historyButton.addEventListener("click", openHistory);
        closeButton.addEventListener("click", closeHistory);
        historyOverlay.addEventListener("click", closeHistory);
        clearButton.addEventListener("click", clearHistory);

        historyPanel.addEventListener("keydown", trapFocus);

        var calculateButton = document.getElementById("calculateBtn");

        if (calculateButton) {
            // The calculator's own click handler is registered first, so the
            // successful calculation is already available when this runs.
            calculateButton.addEventListener("click", addCurrentCalculation);
        }

        // A restored back/forward-cache page must keep its history. Re-read
        // the saved records so the restored page stays in sync with the
        // current session without ever discarding them.
        window.addEventListener("pageshow", function (event) {
            if (!event.persisted || !storage) {
                return;
            }

            records = loadStoredRecords();
            lastRecordedSignature = records.length
                ? (records[0].signature || null)
                : null;

            renderHistory();
        });

        renderHistory();
    }
// ==================================================
// FUNCTION: BIND EVENTS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: INIT START
// This function performs the init step of this calculator.
// This is where this function's work happens.
// ==================================================
    function init() {
        var header = document.querySelector(".header");

        if (!header) {
            return;
        }

        // Restore this calculator's own saved history before rendering it.
        records = loadStoredRecords();
        lastRecordedSignature = records.length
            ? (records[0].signature || null)
            : null;

        createHistoryButton(header);
        createHistoryPanel();
        bindEvents();
    }
// ==================================================
// FUNCTION: INIT END
// This function ends here.
// ==================================================

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

/* ==================================================
   CALCULATION HISTORY JAVASCRIPT END
   This JavaScript file ends here.
================================================== */