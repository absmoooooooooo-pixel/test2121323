/* ==================================================
   ROUND BAR WITH HEXAGONAL HOLE WEIGHT CALCULATOR JAVASCRIPT START
   Inputs, unit conversion, validation, formula and result display for this calculator.
   Here is the complete logic and the formula of this calculator.
================================================== */
"use strict";

/*
 * Round Bar with Hexagonal Hole Weight Calculator
 *
 * Solid circular cross-section with outer diameter D and a concentric
 * regular hexagonal hole with across-flats dimension A.
 *
 * Area of the circle:
 *     (π / 4) x D²
 * Area of the regular hexagon from its across-flats dimension:
 *     (√3 / 2) x A²
 *
 * Net area = circle area - hexagon area.
 *
 * The hexagon fits inside the circle when its circumradius (A / √3) is
 * not greater than the circle radius (D / 2), i.e. A ≤ (√3 / 2) x D.
 *
 * Weight (kg) = net area (mm²) x length (mm) x density (g/cm³)
 * / 1,000,000.
 *
 * All dimensions are converted to millimeters before calculating.
 * Density is always in g/cm³.
 */

const MATERIALS = window.MW_MATERIALS || {};

const $ = id => document.getElementById(id);

/* 1 inch = 25.4 millimeters. */
const INCH_TO_MM = 25.4;

/* Dimension inputs, in mobile keyboard navigation order. */
const FIELDS = [
    "diameter",
    "a",
    "length"
];

const FIELD_NAMES = [
    { id: "diameter", name: "Outer Diameter" },
    { id: "a", name: "Hexagonal Hole Across-Flats" },
    { id: "length", name: "Length" }
];

let currentUnit = "mm";
let lastCalculation = null;
let autoRecalculate = false;

/* NUMBER FORMATTING */

// ==================================================
// NUMBER FORMATTING HELPER START
// Rounds the number and adds thousands separators before it is shown.
// Here is the helper that shows numbers in a neat format.
// ==================================================
function formatNumber(value, decimals = 2) {
    return value.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}
// ==================================================
// NUMBER FORMATTING HELPER END
// This function ends here.
// ==================================================

// ==================================================
// DIMENSION FORMATTING HELPER START
// Turns a dimension value into the short text used in the diagram labels.
// Here the value of the dimension is formatted.
// ==================================================
function formatDimension(value) {
    return Number(value).toLocaleString("en-IN", {
        maximumFractionDigits: 4
    });
}
// ==================================================
// DIMENSION FORMATTING HELPER END
// This function ends here.
// ==================================================

/* MATERIAL DENSITY */

// ==================================================
// MATERIAL DENSITY LOOKUP START
// Returns the density in g/cm3 for the material the user selected.
// Here the density of the chosen material is obtained.
// ==================================================
function getDensity() {
    const selectedKey = $("material").value;

    if (selectedKey === "custom") {
        return Number($("customDensity").value);
    }

    const material = MATERIALS[selectedKey];

    return material ? material.density : NaN;
}
// ==================================================
// MATERIAL DENSITY LOOKUP END
// This function ends here.
// ==================================================

// ==================================================
// MATERIAL DENSITY DISPLAY START
// Shows the selected material density under the material dropdown.
// Here the density value is shown on the screen.
// ==================================================
function updateDensityDisplay() {
    const selectedKey = $("material").value;
    const isCustom = selectedKey === "custom";

    $("customBox").style.display = isCustom ? "block" : "none";

    if (isCustom) {
        const customValue = $("customDensity").value.trim();

        $("densityInfo").textContent =
            customValue !== "" &&
            Number.isFinite(Number(customValue)) &&
            Number(customValue) > 0
                ? "Custom Density — " +
                  formatNumber(Number(customValue), 3) +
                  " g/cm³"
                : "Enter custom density";

        return;
    }

    const material = MATERIALS[selectedKey];

    if (!material) {
        $("densityInfo").textContent = "Density is not configured for this material.";
        return;
    }

    $("densityInfo").textContent =
        material.name + " — " +
        formatNumber(material.density, 2) +
        " g/cm³";
}
// ==================================================
// MATERIAL DENSITY DISPLAY END
// This function ends here.
// ==================================================

/* UNIT CONVERSION */

// ==================================================
// MM / INCHES UNIT CONVERSION START
// Switches the calculator between MM and Inches and converts the typed values.
// Here the conversion between mm and inches happens.
// ==================================================
function changeUnit(newUnit) {
    if (newUnit === currentUnit) {
        return;
    }

    // Keep the same physical dimensions on screen when the unit changes:
    // 1 inch = 25.4 mm. The exact millimetre value is remembered, so
    // switching back restores the number the user originally entered.
    MWUnitSwitch.convert(currentUnit, newUnit);

    currentUnit = newUnit;

    updateDimensionValues();

    $("mmBtn").classList.toggle("active", newUnit === "mm");
    $("inchBtn").classList.toggle("active", newUnit === "in");

    $("mmBtn").setAttribute("aria-pressed", String(newUnit === "mm"));
    $("inchBtn").setAttribute("aria-pressed", String(newUnit === "in"));

    $("unitNote").textContent =
        newUnit === "mm"
            ? "All dimensions are in millimeters."
            : "All dimensions are in inches.";

    updateDensityDisplay();

    if (autoRecalculate) {
        calculateWeight();
    }
}
// ==================================================
// MM / INCHES UNIT CONVERSION END
// This function ends here.
// ==================================================

/* MATERIAL CHANGE */

// ==================================================
// MATERIAL SELECTION HANDLING START
// Runs when another material is picked and refreshes the density.
// Here the density is updated when the material is changed.
// ==================================================
function materialChanged() {
    updateDensityDisplay();

    if (autoRecalculate) {
        calculateWeight();
    }
}
// ==================================================
// MATERIAL SELECTION HANDLING END
// This function ends here.
// ==================================================

// ==================================================
// READ INPUT VALUES START
// Reads every input field and returns the numbers used by the formula.
// Here the values are read from the input fields.
// ==================================================
function readValues() {
    const values = {};

    FIELDS.forEach(id => {
        values[id] = Number($(id).value);
    });

    return values;
}
// ==================================================
// READ INPUT VALUES END
// This function ends here.
// ==================================================

/* SHAPE GEOMETRY */


// ==================================================
// FUNCTION: VALIDATE SHAPE START
// This function performs the validate shape step of this calculator.
// This is where this function's work happens.
// ==================================================
function validateShape(d) {
    // A regular hexagon with across-flats A has circumradius A / √3.
    // It fits inside a circle of diameter D when A / √3 ≤ D / 2.
    const maxAcrossFlats = (Math.sqrt(3) / 2) * d.diameter;

    if (d.a > maxAcrossFlats) {
        return "Hexagonal hole across-flats is too large for the outer diameter.";
    }

    return "";
}
// ==================================================
// FUNCTION: VALIDATE SHAPE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: GET SHAPE DETAILS START
// This function performs the get shape details step of this calculator.
// This is where this function's work happens.
// ==================================================
function getShapeDetails(d, unit) {
    return "Diameter: " + formatDimension(d.diameter) + " " + unit +
        " | Hexagonal Hole: " + formatDimension(d.a) + " " + unit +
        " | Length: " + formatDimension(d.length) + " " + unit;
}
// ==================================================
// FUNCTION: GET SHAPE DETAILS END
// This function ends here.
// ==================================================

/* INPUT VALIDATION */

// ==================================================
// INPUT VALIDATION START
// Checks the fields for empty, non-numeric or out-of-range values.
// Here it is checked whether the input values are correct.
// ==================================================
function validateInputs() {
    for (const item of FIELD_NAMES) {
        const rawValue = $(item.id).value.trim();
        const value = Number(rawValue);

        if (
            rawValue === "" ||
            !Number.isFinite(value) ||
            value <= 0
        ) {
            return item.name +
                " is required. Please enter a valid positive number.";
        }
    }

    const quantityRaw = $("quantity").value.trim();
    const quantity = Number(quantityRaw);

    if (
        quantityRaw === "" ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1
    ) {
        return "Quantity must be a positive whole number.";
    }

    if ($("material").value === "custom") {
        const rawDensity = $("customDensity").value.trim();
        const customDensity = Number(rawDensity);

        if (
            rawDensity === "" ||
            !Number.isFinite(customDensity) ||
            customDensity <= 0
        ) {
            return "Please enter a valid positive custom density in g/cm³.";
        }
    }

    const density = getDensity();

    if (!Number.isFinite(density) || density <= 0) {
        return "Invalid material density.";
    }

    const shapeError = validateShape(readValues());

    if (shapeError) {
        return shapeError;
    }

    return "";
}
// ==================================================
// INPUT VALIDATION END
// This function ends here.
// ==================================================

/* WEIGHT CALCULATION */

// ==================================================
// WEIGHT CALCULATION FORMULA START
// Applies the metal weight formula (volume x density) and shows kg, tonnes and the extra results.
// Here is the complete logic that calculates the weight.
// ==================================================
async function calculateWeight() {
    const errorMessage = validateInputs();

    $("error").textContent = errorMessage;

    if (errorMessage) {
        $("results").style.display = "none";
        lastCalculation = null;
        return;
    }

    const values = readValues();
    const quantity = Number($("quantity").value);
    const density = getDensity();

    // Convert entered dimensions to millimeters.
    const dimensionFactor = currentUnit === "in" ? INCH_TO_MM : 1;
    const mm = {};

    FIELDS.forEach(id => {
        mm[id] = values[id] * dimensionFactor;
    });

    /* Engineering formulas run on the backend (POST /api/calculate/round-bar-with-hexagonal-hole). */
    let calc;

    try {
        calc = await MWCalc.calculate("round-bar-with-hexagonal-hole", {
            values: values,
            unit: currentUnit,
            density: density,
            quantity: quantity,
            material: $("material").value
        });
    } catch (error) {
        $("error").textContent =
            error.message || "Calculation service is unavailable.";
        $("results").style.display = "none";
        lastCalculation = null;
        return;
    }

    const { areaMM2, volumeMM3, volumeM3, singleWeight, totalWeight } = calc;

    if (
        !Number.isFinite(areaMM2) ||
        !Number.isFinite(volumeM3) ||
        !Number.isFinite(singleWeight) ||
        !Number.isFinite(totalWeight)
    ) {
        $("error").textContent =
            "Values are too large to calculate safely.";

        $("results").style.display = "none";
        lastCalculation = null;
        return;
    }

    const selectedKey = $("material").value;

    const materialName =
        selectedKey === "custom"
            ? "Custom Material"
            : MATERIALS[selectedKey].name;

    lastCalculation = {
        values,
        quantity,
        density,
        areaMM2,
        volumeM3,
        singleWeight,
        totalWeight,
        materialName,
        unit: currentUnit
    };

    /* DISPLAY RESULTS */

    $("totalWeight").textContent =
        formatNumber(totalWeight, 3) + " kg";

    $("singleWeight").textContent =
        formatNumber(singleWeight, 3) + " kg";

    $("resultQuantity").textContent =
        quantity + (quantity === 1 ? " pc" : " pcs");

    $("volume").textContent =
        volumeM3.toFixed(8) + " m³";

    $("resultDensity").textContent =
        formatNumber(density, 2) + " g/cm³";

    $("tonnes").textContent =
        formatNumber(totalWeight / 1000, 6) +
        " metric tonnes";

    $("dimensions").textContent =
        "Material: " + materialName + " | " +
        getShapeDetails(values, currentUnit);

    $("results").style.display = "block";

    autoRecalculate = true;
}
// ==================================================
// WEIGHT CALCULATION FORMULA END
// This function ends here.
// ==================================================

/* DIMENSION LABELS AND DYNAMIC VALUES (A, D, L) */

/*
 * Default (no valid entered value): each label stays centered on its
 * dimension line (A, D, L) with no "=" and no value.
 * When a valid value is entered: that label moves outside to a clear
 * position and shows "Label = value" (no box). Each dimension updates
 * independently; clearing returns it to its centered position.
 * Dimension line/arrow positions and drawing geometry are unchanged.
 */
// ==================================================
// FUNCTION: UPDATE DIMENSION LABEL START
// This function performs the update dimension label step of this calculator.
// This is where this function's work happens.
// ==================================================
function updateDimensionLabel(config) {
    const input = $(config.inputId);
    const label = $(config.labelId);

    if (!input || !label) {
        return;
    }

    const raw = input.value.trim();
    const num = Number(raw);
    const valid = raw !== "" && Number.isFinite(num) && num > 0;

    if (valid) {
        label.textContent = config.name + " = " + raw;
        label.setAttribute("x", config.outside.x);
        label.setAttribute("y", config.outside.y);
        label.setAttribute("text-anchor", config.outside.anchor);
    } else {
        label.textContent = config.name;
        label.setAttribute("x", config.center.x);
        label.setAttribute("y", config.center.y);
        label.setAttribute("text-anchor", config.center.anchor);
    }
}
// ==================================================
// FUNCTION: UPDATE DIMENSION LABEL END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: UPDATE DIMENSION A START
// This function performs the update dimension a step of this calculator.
// This is where this function's work happens.
// ==================================================
function updateDimensionA() {
    var input = document.getElementById("a");
    var el = document.getElementById("dimA");
    var lineTop = document.getElementById("dimALineTop");
    var lineBot = document.getElementById("dimALineBot");
    if (!input || !el) return;

    var raw = input.value.trim();
    var parsed = raw === "" ? NaN : Number(raw);
    var hasValue = raw !== "" && Number.isFinite(parsed) && parsed > 0;

    /* Keep the letter A at its exact original position (centered on the
       external dimension line). The value, when present, appears to its right. */
    el.setAttribute("x", "210");
    el.setAttribute("y", "90");
    el.setAttribute("text-anchor", "middle");
    el.textContent = "A";

    /* Gap in the dimension line directly behind the rendered A label, with a
       small clearance beyond its edges (computed from actual text bounds). */
    if (lineTop && lineBot && typeof el.getBBox === "function") {
        try {
            var bb = el.getBBox();
            var padY = 3;
            var gapTop = Math.max(62.6, bb.y - padY);
            var gapBot = Math.min(107.4, bb.y + bb.height + padY);
            lineTop.setAttribute("d", "M 210 62.6 V " + gapTop.toFixed(2));
            lineBot.setAttribute("d", "M 210 " + gapBot.toFixed(2) + " V 107.4");
        } catch (e) { /* keep existing line geometry */ }
    }

    if (hasValue) {
        /* Anchor so the "A" glyph stays at the same rendered position. */
        try {
            if (typeof el.getBBox === "function") {
                var bbA = el.getBBox();
                el.setAttribute("text-anchor", "start");
                el.setAttribute("x", bbA.x.toFixed(2));
            }
        } catch (e) { /* fallback keeps middle anchor */ }
        el.textContent = "A = " + raw;
    }
}
// ==================================================
// FUNCTION: UPDATE DIMENSION A END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: UPDATE DIMENSION VALUES START
// This function performs the update dimension values step of this calculator.
// This is where this function's work happens.
// ==================================================
function updateDimensionValues() {
    /* D: label stays above its dimension line at a fixed, close position;
       only the text changes (e.g. "D" -> "D = 23"). */
    updateDimensionLabel({
        inputId: "diameter",
        labelId: "dimD",
        name: "D",
        center: { x: "150", y: "149", anchor: "middle" },
        outside: { x: "150", y: "149", anchor: "middle" }
    });
    /* A: fixed position; gap behind the "A" label; value shown to the right. */
    updateDimensionA();
    /* L: label stays above its dimension line at a fixed, close position;
       only the text changes (e.g. "L" -> "L = 23"). */
    updateDimensionLabel({
        inputId: "length",
        labelId: "dimL",
        name: "L",
        center: { x: "150", y: "149", anchor: "middle" },
        outside: { x: "150", y: "149", anchor: "middle" }
    });
}
// ==================================================
// FUNCTION: UPDATE DIMENSION VALUES END
// This function ends here.
// ==================================================

/* RESET CALCULATOR */

// ==================================================
// RESET CALCULATOR START
// Clears the inputs and puts the calculator back to its starting state.
// Here the calculator is brought back to its starting state.
// ==================================================
function resetCalculator() {
    FIELDS.forEach(id => {
        $(id).value = "";
    });

    $("quantity").value = "1";
    $("material").value = "carbon-steel";
    $("customDensity").value = "";

    currentUnit = "mm";

    $("mmBtn").classList.add("active");
    $("inchBtn").classList.remove("active");

    $("mmBtn").setAttribute("aria-pressed", "true");
    $("inchBtn").setAttribute("aria-pressed", "false");

    $("unitNote").textContent =
        "All dimensions are in millimeters.";

    $("error").textContent = "";
    $("results").style.display = "none";

    lastCalculation = null;
    autoRecalculate = false;

    updateDensityDisplay();
    updateDimensionValues();
}
// ==================================================
// RESET CALCULATOR END
// This function ends here.
// ==================================================

/* EVENT LISTENERS */

$("mmBtn").addEventListener("click", () => {
    changeUnit("mm");
});

$("inchBtn").addEventListener("click", () => {
    changeUnit("in");
});

$("diameter").addEventListener("input", updateDimensionValues);
$("a").addEventListener("input", updateDimensionValues);
$("length").addEventListener("input", updateDimensionValues);

$("material").addEventListener("change", materialChanged);

$("calculateBtn").addEventListener("click", calculateWeight);

$("resetBtn").addEventListener("click", resetCalculator);

$("quantity").addEventListener("input", () => {
    if (autoRecalculate) {
        calculateWeight();
    }
});

$("customDensity").addEventListener("input", () => {
    updateDensityDisplay();

    if (autoRecalculate) {
        calculateWeight();
    }
});

/*
 * Mobile keyboard navigation.
 * "Next" moves through the dimension fields in order.
 * Enter on the last dimension triggers the calculation.
 */
FIELDS.forEach((id, index) => {
    $(id).addEventListener("keydown", event => {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();

        if (index < FIELDS.length - 1) {
            $(FIELDS[index + 1]).focus();
        } else {
            $("calculateBtn").click();
        }
    });
});

/* INITIALIZE */

updateDensityDisplay();
updateDimensionValues();

/* CALCULATION HISTORY CONFIG */

window.CALCULATOR_HISTORY_CONFIG = {
    calculatorName: "Round Bar with Hexagonal Hole Weight Calculator",
    shapeName: "Round Bar (Hex Hole)",
    sizeLabels: true,
    dimensions: [
        { key: "diameter", label: "Outer Diameter (D)" },
        { key: "a", label: "Hex Across-Flats (A)" },
        { key: "length", label: "Length (L)" }
    ],
    getCalculation: function () {
        return lastCalculation;
    }
};

/* MATERIAL DENSITY DISCLOSURE (auto) */
(function () {
    const toggle = document.getElementById("roundHexHoleDensityToggle");
    const table = document.getElementById("roundHexHoleDensityTable");
    if (!toggle || !table) return;
    const extraRows = table.querySelectorAll(".density-extra");
    if (!extraRows.length) return;
    toggle.addEventListener("click", function () {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        const nextExpanded = !expanded;
        toggle.setAttribute("aria-expanded", String(nextExpanded));
        toggle.classList.toggle("is-open", nextExpanded);
        extraRows.forEach(function (row) { row.hidden = !nextExpanded; });
    });
})();

/* ==================================================
   ROUND BAR WITH HEXAGONAL HOLE WEIGHT CALCULATOR JAVASCRIPT END
   This JavaScript file ends here.
================================================== */