/* ==================================================
   SOLID ROUND BAR WEIGHT CALCULATOR JAVASCRIPT START
   Inputs, unit conversion, validation, formula and result display for this calculator.
   Here is the complete logic and the formula of this calculator.
================================================== */
"use strict";

/*
 * Round Bar Weight Calculator
 *
 * Density values are stored in g/cm³.
 *
 * For diameter and length in millimeters:
 *
 * Weight (kg) =
 * (π / 4) × Diameter² (mm) × Length (mm)
 * × Density (g/cm³) / 1,000,000
 *
 * Total weight = weight of one bar × quantity.
 */

const MATERIALS = window.MW_MATERIALS || {};

const $ = id => document.getElementById(id);

/* 1 inch = 25.4 millimeters. */
const INCH_TO_MM = 25.4;

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

    $("mmBtn").classList.toggle("active", newUnit === "mm");
    $("inchBtn").classList.toggle("active", newUnit === "in");

    $("mmBtn").setAttribute("aria-pressed", String(newUnit === "mm"));
    $("inchBtn").setAttribute("aria-pressed", String(newUnit === "in"));

    $("unitNote").textContent =
        newUnit === "mm"
            ? "All dimensions are in millimeters."
            : "All dimensions are in inches.";

    // Density always remains in g/cm³, regardless of dimension unit.
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

/* INPUT VALIDATION */

// ==================================================
// INPUT VALIDATION START
// Checks the fields for empty, non-numeric or out-of-range values.
// Here it is checked whether the input values are correct.
// ==================================================
function validateInputs() {
    const dimensions = [
        { id: "diameter", name: "Diameter" },
        { id: "length", name: "Length" }
    ];

    for (const item of dimensions) {
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

    const diameter = Number($("diameter").value);
    const length = Number($("length").value);
    const quantity = Number($("quantity").value);

    // Density is always in g/cm³.
    const density = getDensity();

    // Convert entered dimensions to millimeters.
    const dimensionFactor = currentUnit === "in" ? INCH_TO_MM : 1;

    const diameterMM = diameter * dimensionFactor;
    const lengthMM = length * dimensionFactor;

    /* Engineering formulas run on the backend (POST /api/calculate/round-bar). */
    let calc;

    try {
        calc = await MWCalc.calculate("round-bar", {
            values: { diameter: diameter, length: length },
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

    const { volumeMM3, volumeM3, singleWeight, totalWeight } = calc;

    if (
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
        diameter,
        length,
        quantity,
        density,
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
        "Material: " + materialName +
        " | Diameter: " + formatDimension(diameter) + " " + currentUnit +
        " | Length: " + formatDimension(length) + " " + currentUnit;

    $("results").style.display = "block";

    autoRecalculate = true;
}
// ==================================================
// WEIGHT CALCULATION FORMULA END
// This function ends here.
// ==================================================

/* RESET CALCULATOR */

// ==================================================
// RESET CALCULATOR START
// Clears the inputs and puts the calculator back to its starting state.
// Here the calculator is brought back to its starting state.
// ==================================================
function resetCalculator() {
    $("diameter").value = "";
    $("length").value = "";

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
 * "Next" on the diameter field moves to the length field.
 * Enter on the length field triggers the calculation.
 */
$("diameter").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        $("length").focus();
    }
});

$("length").addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        $("calculateBtn").click();
    }
});

/* INITIALIZE */

updateDensityDisplay();

/* CALCULATION HISTORY CONFIG */

window.CALCULATOR_HISTORY_CONFIG = {
    calculatorName: "Round Bar Weight Calculator",
    shapeName: "Round Bar",
    sizeLabels: false,
    dimensions: [
        { key: "diameter", label: "Diameter (D)" },
        { key: "length", label: "Length (L)" }
    ],
    getCalculation: function () {
        return lastCalculation;
    }
};

/* MATERIAL DENSITY DISCLOSURE (auto) */
(function () {
    const toggle = document.getElementById("roundBarDensityToggle");
    const table = document.getElementById("roundBarDensityTable");
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
   SOLID ROUND BAR WEIGHT CALCULATOR JAVASCRIPT END
   This JavaScript file ends here.
================================================== */