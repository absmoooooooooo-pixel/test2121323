/* ==================================================
   CALCULATION API CLIENT START
   Sends the typed values to the backend and returns the finished numbers.
   The engineering formulas live on the server, not in this file.
================================================== */
"use strict";

(function () {
    var TIMEOUT_MS = 15000;

    /*
     * Built-in density fallback.
     *
     * The backend is still the source of truth: /api/bootstrap.js is loaded
     * before this file and its values are never overwritten. The copy below is
     * used only when that request did not arrive (for example an offline PWA
     * start or a temporary network failure), so a standard material such as
     * Carbon Steel can never show "Density is not configured". A later
     * /api/materials response replaces these values with the server table.
     */
    var FALLBACK_SECTION_MATERIALS = {
        "carbon-steel": { name: "Carbon Steel", density: 7.85 },
        "stainless-steel": { name: "Stainless Steel", density: 8.00 },
        "aluminium": { name: "Aluminium", density: 2.70 },
        "brass": { name: "Brass", density: 8.45 },
        "bronze": { name: "Bronze", density: 8.73 },
        "cast-iron": { name: "Cast Iron", density: 7.20 },
        "copper": { name: "Copper", density: 8.96 }
    };

    var FALLBACK_DISH_MATERIALS = {
        "carbon-steel": { name: "Carbon Steel", density: 7850 },
        "ss-304": { name: "Stainless Steel 304", density: 7930 },
        "ss-316": { name: "Stainless Steel 316", density: 7980 },
        "ss-316l": { name: "Stainless Steel 316L", density: 8000 },
        "aluminium": { name: "Aluminium", density: 2700 },
        "custom": { name: "Custom Material", density: null }
    };

    /* True when the page did not receive the server table and is running on
       the fallback values above. It makes loadMaterials() retry /api/materials
       instead of accepting the fallback as the final table. */
    var needsServerMaterials = false;

    function installMissing(target, source) {
        Object.keys(source).forEach(function (key) {
            if (!Object.prototype.hasOwnProperty.call(target, key)) {
                target[key] = source[key];
            }
        });
    }

    var receivedSectionTable = Boolean(
        window.MW_MATERIALS && Object.keys(window.MW_MATERIALS).length
    );
    var receivedDishTable = Boolean(
        window.MW_DISH_MATERIALS && Object.keys(window.MW_DISH_MATERIALS).length
    );

    window.MW_MATERIALS = window.MW_MATERIALS || {};
    window.MW_DISH_MATERIALS = window.MW_DISH_MATERIALS || {};
    installMissing(window.MW_MATERIALS, FALLBACK_SECTION_MATERIALS);
    installMissing(window.MW_DISH_MATERIALS, FALLBACK_DISH_MATERIALS);

    needsServerMaterials = !receivedSectionTable || !receivedDishTable;

    /* The promise of the most recent API calculation. The shared history
       listens to it after the Calculate click so it records the result that
       has actually finished, not the previous one. */
    var lastCalculationPromise = null;

    /*
     * Async results are sequenced centrally. A slow response from an older
     * input state must never overwrite the answer for the newest state, and
     * an input that becomes invalid before the response arrives must clear
     * the pending display instead of letting an old result reappear.
     */
    var calculationSequence = 0;
    var pendingCalculations = [];
    var activeCalculationControllers = [];

    function invalidatePendingCalculations() {
        calculationSequence += 1;
        pendingCalculations = [];
        lastCalculationPromise = null;

        /* Abort the network work as well as hiding the answer. This prevents
           a response from a superseded state (or from an unloaded page) from
           running its callback after the DOM has gone away. */
        activeCalculationControllers.forEach(function (controller) {
            try {
                controller.abort();
            } catch (error) {
                /* An already-finished request needs no cleanup. */
            }
        });
        activeCalculationControllers = [];
    }

    function settleCalculations(result, error) {
        var pending = pendingCalculations;
        pendingCalculations = [];

        pending.forEach(function (item) {
            if (error) {
                item.reject(error);
            } else {
                item.resolve(result);
            }
        });
    }

    function isHistoryControl(target) {
        return Boolean(
            target && target.closest &&
            (target.closest("#historyPanel") || target.closest("#historyOverlay"))
        );
    }

    /* Capture phase runs before the calculator's own handlers. An invalid
       click, reset or unit switch must not let an in-flight result land. */
    document.addEventListener("click", function (event) {
        var target = event.target;

        if (!target || !target.closest || isHistoryControl(target)) {
            return;
        }

        if (target.closest(
            "#calculateBtn, #resetBtn, #mmBtn, #inchBtn, [data-divisions]"
        )) {
            invalidatePendingCalculations();
        }
    }, true);

    /* Text and number fields fire input on every edit. Selects fire change
       instead; excluding input elements here keeps a blur-only change from
       cancelling a calculation that is still legitimately in flight. */
    document.addEventListener("input", function (event) {
        if (!isHistoryControl(event.target)) {
            invalidatePendingCalculations();
        }
    }, true);

    document.addEventListener("change", function (event) {
        var target = event.target;

        if (target && target.tagName === "SELECT" &&
            !isHistoryControl(target)) {
            invalidatePendingCalculations();
        }
    }, true);

    /* A response arriving after the page has gone away has no result panel to
       update. Discard those callbacks before the browser tears down the DOM. */
    ["pagehide", "beforeunload", "unload"].forEach(function (type) {
        window.addEventListener(type, invalidatePendingCalculations);
    });

    /*
     * The backend URL comes from the server, never from a hard-coded host:
     *   - /api/bootstrap.js sets window.MW_API_BASE from the environment,
     *   - a <meta name="mw-api-base"> tag can override it,
     *   - an empty value means "same origin", the normal setup.
     */
    var LOCAL_API_BASE = "http://127.0.0.1:8080";

    function baseUrlCandidates() {
        var candidates = [];

        function add(value) {
            var base = typeof value === "string" ? value.replace(/\/+$/, "") : "";

            if (base && candidates.indexOf(base) === -1) {
                candidates.push(base);
            }
        }

        if (typeof window.MW_API_BASE === "string") {
            add(window.MW_API_BASE);
        }

        var meta = document.querySelector('meta[name="mw-api-base"]');

        if (meta) {
            add(meta.content);
        }

        if (candidates.indexOf("") === -1) {
            candidates.push("");
        }

        var location = window.location;
        var localPage = location.protocol === "file:" ||
            location.hostname === "127.0.0.1" ||
            location.hostname === "localhost";
        var alreadyOnBackend = location.protocol !== "file:" &&
            (location.hostname === "127.0.0.1" || location.hostname === "localhost") &&
            (location.port === "8080" || location.port === "");

        /* When the page is opened from disk or a separate local web server,
           /api/* does not exist there. Retry the backend's local address. */
        if (localPage && !alreadyOnBackend) {
            add(LOCAL_API_BASE);
        }

        return candidates.length ? candidates : [""];
    }

    function unavailable() {
        return new Error(
            "The calculation service could not be reached. " +
            "Please check your connection and try again."
        );
    }

    async function request(path, options, trackForInvalidation) {
        options = options || {};

        var controller = new AbortController();

        if (trackForInvalidation) {
            activeCalculationControllers.push(controller);
        }

        var timer = setTimeout(function () {
            controller.abort();
        }, TIMEOUT_MS);

        var response;
        var lastNetworkError = null;
        var candidates = baseUrlCandidates();

        try {
            for (var i = 0; i < candidates.length; i += 1) {
                try {
                    response = await fetch(candidates[i] + path, {
                        method: options.method || "GET",
                        headers: options.headers || {},
                        body: options.body,
                        signal: controller.signal,
                        credentials: "same-origin"
                    });
                } catch (error) {
                    lastNetworkError = error;
                    continue;
                }

                /* A static server answers 404 for /api/*. If another local
                   API base was found, try it before reporting a failure. */
                if (response.status === 404 && i < candidates.length - 1) {
                    continue;
                }

                break;
            }

            if (!response) {
                throw lastNetworkError || unavailable();
            }
        } catch (error) {
            throw unavailable();
        } finally {
            clearTimeout(timer);

            var index = activeCalculationControllers.indexOf(controller);

            if (index !== -1) {
                activeCalculationControllers.splice(index, 1);
            }
        }

        var payload = null;

        try {
            payload = await response.json();
        } catch (error) {
            payload = null;
        }

        if (!response.ok) {
            var message = payload && payload.error && payload.error.message
                ? payload.error.message
                : "The calculation could not be completed.";

            var failure = new Error(message);
            failure.status = response.status;
            failure.field = payload && payload.error ? payload.error.field : null;
            throw failure;
        }

        if (!payload || payload.ok !== true) {
            throw unavailable();
        }

        return payload;
    }

    /**
     * Runs one calculator on the backend.
     *
     * @param {string} slug    calculator folder name, e.g. "plate"
     * @param {object} payload { values, unit, density, quantity, material }
     * @returns {Promise<object>} the finished result object
     */
    async function calculate(slug, payload) {
        var token = ++calculationSequence;
        var resolveCalculation;
        var rejectCalculation;
        var sharedPromise = new Promise(function (resolve, reject) {
            resolveCalculation = resolve;
            rejectCalculation = reject;
        });

        pendingCalculations.push({
            token: token,
            resolve: resolveCalculation,
            reject: rejectCalculation
        });
        lastCalculationPromise = sharedPromise;

        request("/api/calculate/" + encodeURIComponent(slug), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }, true).then(function (body) {
            /* Only the newest input state owns the result panel. Every caller
               from this burst receives that same newest result. */
            if (token === calculationSequence) {
                settleCalculations(body.result, null);
            }
        }, function (error) {
            if (token === calculationSequence) {
                settleCalculations(null, error);
            }
        });

        return sharedPromise;
    }

    /* ==================================================
       MATERIAL DENSITY TABLES

       /api/bootstrap.js defines window.MW_MATERIALS, but that script only
       exists on the page's own origin. When the frontend is served on a
       different host from the API (or that one request fails) the table is
       empty, so every valid material would show "Unknown material".

       Here the same table is fetched from the API base and copied into the
       object the calculator already captured at startup, then the material
       field is refreshed so its density display updates.
    ================================================== */
    function fillMaterialTables(body) {
        var tables = [
            { name: "MW_MATERIALS", source: body.sections },
            { name: "MW_DISH_MATERIALS", source: body.dishEnds }
        ];
        var filled = 0;

        tables.forEach(function (table) {
            var target = window[table.name];

            if (!target || !table.source || typeof table.source !== "object") {
                return;
            }

            Object.keys(table.source).forEach(function (key) {
                target[key] = table.source[key];
                filled += 1;
            });
        });

        return filled;
    }

    function refreshMaterialFields() {
        /* The dish ends page keeps a free-text density field next to its
           material select. Do not overwrite a value the user already typed. */
        var densityInput = document.getElementById("density");
        /* Dish ends pre-fill this field with a default density. Only a value
           the user actually edited must block a late material-table refresh. */
        var userEditedDensity = densityInput &&
            densityInput.getAttribute("data-user-edited") === "true";

        ["material", "materialSelect"].forEach(function (id) {
            var select = document.getElementById(id);

            if (!select || (userEditedDensity && select.id === "material")) {
                return;
            }

            select.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    /**
     * Loads the density tables when the page did not receive them.
     * Called automatically at startup; exposed for retries.
     *
     * @param {boolean} force refetch even when the table is already present
     * @returns {Promise<boolean>} true when the tables were filled
     */
    function loadMaterials(force) {
        if (!force && !needsServerMaterials) {
            return Promise.resolve(false);
        }

        return request("/api/materials")
            .then(function (body) {
                if (!body || body.ok !== true || !fillMaterialTables(body)) {
                    return false;
                }

                needsServerMaterials = false;
                refreshMaterialFields();
                document.dispatchEvent(new CustomEvent("mw:materials-loaded"));
                return true;
            })
            .catch(function () {
                return false;
            });
    }

    /* Kept for other scripts that read the resolved primary API base. */
    function baseUrl() {
        return baseUrlCandidates()[0] || "";
    }

    window.MWCalc = {
        calculate: calculate,
        request: request,
        baseUrl: baseUrl,
        loadMaterials: loadMaterials,
        getLastCalculationPromise: function () {
            return lastCalculationPromise;
        }
    };

    loadMaterials();
})();
/* ==================================================
   CALCULATION API CLIENT END
   This file ends here.
================================================== */
