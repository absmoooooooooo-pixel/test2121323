/* ==================================================
   HOME PAGE JAVASCRIPT START
   Builds the calculator cards and runs the category filters.
   Here is the logic for the cards and the filters.
================================================== */
(function () {
    "use strict";

    var data = window.ENGINEERING_DASHBOARD;
    var filterPills = document.getElementById("filterPills");
    var toolSections = document.getElementById("toolSections");

    if (!data || !Array.isArray(data.tools) || !Array.isArray(data.categories)) {
        if (toolSections) {
            toolSections.innerHTML =
                '<p class="data-error">The engineering tools could not be loaded. Please refresh the app.</p>';
        }
        return;
    }

    var tools = data.tools.slice();
    var categories = data.categories.slice();
    var knownCategories = {};
    var state = { category: "all" };

    categories.forEach(function (category) {
        knownCategories[category.id] = category;
    });

    // A future calculator can use a category that is not in the manifest yet.
    tools.forEach(function (tool) {
        if (!knownCategories[tool.category]) {
            var fallback = {
                id: tool.category || "other",
                name: "Other engineering tools",
                icon: "generic",
                tone: "slate"
            };
            knownCategories[fallback.id] = fallback;
            categories.push(fallback);
        }
    });

// ==================================================
// FUNCTION: ESCAPE HTML START
// This function performs the escape html step of this calculator.
// This is where this function's work happens.
// ==================================================
    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[character];
        });
    }
// ==================================================
// FUNCTION: ESCAPE HTML END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CATEGORY OF START
// This function performs the category of step of this calculator.
// This is where this function's work happens.
// ==================================================
    function categoryOf(tool) {
        return knownCategories[tool.category] || knownCategories.other;
    }
// ==================================================
// FUNCTION: CATEGORY OF END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: COUNT FOR START
// This function performs the count for step of this calculator.
// This is where this function's work happens.
// ==================================================
    function countFor(categoryId) {
        if (categoryId === "all") return tools.length;
        return tools.filter(function (tool) { return tool.category === categoryId; }).length;
    }
// ==================================================
// FUNCTION: COUNT FOR END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: ART ID FOR START
// This function performs the art id for step of this calculator.
// This is where this function's work happens.
// ==================================================
    function artIdFor(tool) {
        var artId = "art-" + (tool.icon || "generic");
        return document.getElementById(artId) ? artId : "art-generic";
    }
// ==================================================
// FUNCTION: ART ID FOR END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: CARD TEMPLATE START
// This function performs the card template step of this calculator.
// This is where this function's work happens.
// ==================================================
    function cardTemplate(tool) {
        var category = categoryOf(tool);
        var tone = category ? category.tone : "slate";
        var href = encodeURI(tool.path || "");
        var name = tool.name || tool.title || "Engineering tool";
        var title = tool.title || name;
        var artId = artIdFor(tool);

        return '<a class="tool-card" href="' + escapeHtml(href) + '"' +
            ' data-tool-id="' + escapeHtml(tool.id) + '"' +
            ' data-category="' + escapeHtml(tool.category) + '"' +
            ' data-tone="' + escapeHtml(tone) + '"' +
            ' aria-label="Open ' + escapeHtml(title) + '"' +
            ' title="' + escapeHtml(title) + '">' +
            '<span class="tool-thumb">' +
                '<svg class="tool-art" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><use href="#' + artId + '"></use></svg>' +
            '</span>' +
            '<span class="tool-name">' + escapeHtml(name) + '</span>' +
        '</a>';
    }
// ==================================================
// FUNCTION: CARD TEMPLATE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RENDER FILTERS START
// This function performs the render filters step of this calculator.
// This is where this function's work happens.
// ==================================================
    function renderFilters() {
        if (!filterPills) return;
        var pills = [
            '<button type="button" class="filter-pill is-active" data-category="all" aria-pressed="true">' +
                'All tools <span>' + tools.length + '</span>' +
            '</button>'
        ];
        categories.forEach(function (category) {
            var count = countFor(category.id);
            if (!count) return;
            pills.push(
                '<button type="button" class="filter-pill" data-category="' + escapeHtml(category.id) + '"' +
                ' aria-pressed="false" aria-label="' + escapeHtml(category.name + ", " + count + " tools") + '">' +
                escapeHtml(category.name) + ' <span>' + count + '</span>' +
                '</button>'
            );
        });
        filterPills.innerHTML = pills.join("");
    }
// ==================================================
// FUNCTION: RENDER FILTERS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RENDER TOOLS START
// This function performs the render tools step of this calculator.
// This is where this function's work happens.
// ==================================================
    function renderTools() {
        if (!toolSections) return;
        toolSections.innerHTML = '<div class="tool-grid">' + tools.map(cardTemplate).join("") + '</div>';
    }
// ==================================================
// FUNCTION: RENDER TOOLS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SET ACTIVE CONTROLS START
// This function performs the set active controls step of this calculator.
// This is where this function's work happens.
// ==================================================
    function setActiveControls() {
        document.querySelectorAll(".filter-pill").forEach(function (pill) {
            var active = pill.getAttribute("data-category") === state.category;
            pill.classList.toggle("is-active", active);
            pill.setAttribute("aria-pressed", String(active));
        });
    }
// ==================================================
// FUNCTION: SET ACTIVE CONTROLS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: APPLY FILTER START
// Shows the cards that belong to the selected category.
// This is where this function's work happens.
// ==================================================
    function applyFilter() {
        document.querySelectorAll(".tool-card").forEach(function (card) {
            var category = card.getAttribute("data-category");
            card.hidden = state.category !== "all" && category !== state.category;
        });
        if (toolSections) toolSections.setAttribute("aria-busy", "false");
        setActiveControls();
    }
// ==================================================
// FUNCTION: APPLY FILTER END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: INIT CATEGORY ACTIONS START
// This function performs the init category actions step of this calculator.
// This is where this function's work happens.
// ==================================================
    function initCategoryActions() {
        if (!filterPills) return;
        filterPills.addEventListener("click", function (event) {
            var pill = event.target.closest(".filter-pill");
            if (!pill) return;
            state.category = pill.getAttribute("data-category") || "all";
            applyFilter();
        });
    }
// ==================================================
// FUNCTION: INIT CATEGORY ACTIONS END
// This function ends here.
// ==================================================

    renderFilters();
    renderTools();
    initCategoryActions();
    applyFilter();
    document.body.setAttribute("data-dashboard-ready", "true");
})();

/* ==================================================
   HOME PAGE JAVASCRIPT END
   This JavaScript file ends here.
================================================== */