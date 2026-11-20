/* ==================================================
   CIRCULAR PLATE WEIGHT CALCULATOR JAVASCRIPT START
   Inputs, unit conversion, validation, formula and result display for this calculator.
   Here is the complete logic and the formula of this calculator.
================================================== */
"use strict";

/*
 * Circular Plate Weight Calculator
 *
 * Central density configuration:
 * All density values are stored in g/cm³.
 *
 * Weight (kg) =
 * (π / 4) × Diameter (mm)² × Thickness (mm)
 * × Density (g/cm³) / 1,000,000
 */

const MATERIALS = Object.freeze({
    "carbon-steel": Object.freeze({
        name: "Carbon Steel",
        density: 7.85
    }),
    "stainless-steel": Object.freeze({
        name: "Stainless Steel",
        density: 8.00
    }),
    "aluminium": Object.freeze({
        name: "Aluminium",
        density: 2.70
    }),
    "brass": Object.freeze({
        name: "Brass",
        density: 8.45
    }),
    "bronze": Object.freeze({
        name: "Bronze",
        density: 8.73
    }),
    "cast-iron": Object.freeze({
        name: "Cast Iron",
        density: 7.20
    }),
    "copper": Object.freeze({
        name: "Copper",
        density: 8.96
    })
});

const $ = id => document.getElementById(id);

/* Dimension inputs, in mobile keyboard navigation order. */
const FIELDS = [
    "diameter",
    "thickness"
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

/*
 * Returns the selected material's density in g/cm³.
 * Built-in materials always use the centralized configuration.
 * Custom density is also entered in g/cm³.
 */
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

/* MATERIAL DISPLAY */

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
        $("densityInfo").textContent = "Unknown material";
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

    // Intentionally do NOT convert the entered numbers. Switching the
    // unit only changes the unit mode/label; every input keeps exactly
    // the value the user typed (including decimals).

    currentUnit = newUnit;

    $("mmBtn").classList.toggle("active", newUnit === "mm");
    $("inchBtn").classList.toggle("active", newUnit === "in");

    $("mmBtn").setAttribute(
        "aria-pressed",
        String(newUnit === "mm")
    );

    $("inchBtn").setAttribute(
        "aria-pressed",
        String(newUnit === "in")
    );

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
        { id: "thickness", name: "Thickness" }
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
function calculateWeight() {
    const errorMessage = validateInputs();

    $("error").textContent = errorMessage;

    if (errorMessage) {
        $("results").style.display = "none";
        lastCalculation = null;
        return;
    }

    const diameter = Number($("diameter").value);
    const thickness = Number($("thickness").value);
    const quantity = Number($("quantity").value);

    // Density is always in g/cm³.
    const density = getDensity();

    // Convert entered dimensions to millimeters.
    const dimensionFactor = currentUnit === "in" ? 25.4 : 1;

    const diameterMM = diameter * dimensionFactor;
    const thicknessMM = thickness * dimensionFactor;

    /*
     * Formula for dimensions in mm and density in g/cm³:
     *
     * Weight (kg) =
     * (π / 4) × D(mm)² × T(mm) × Density(g/cm³) / 1,000,000
     */

    // Circular face area: (π / 4) × D².
    const areaMM2 = (Math.PI / 4) * diameterMM * diameterMM;

    const volumeMM3 = areaMM2 * thicknessMM;

    // 1,000,000,000 mm³ = 1 m³.
    const volumeM3 = volumeMM3 / 1_000_000_000;

    const singleWeight =
        (volumeMM3 * density) / 1_000_000;

    const totalWeight = singleWeight * quantity;

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
        thickness,
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
        formatNumber(totalWeight, 2) + " kg";

    $("singleWeight").textContent =
        formatNumber(singleWeight, 2) + " kg";

    $("resultQuantity").textContent =
        quantity + (quantity === 1 ? " pc" : " pcs");

    $("volume").textContent =
        volumeM3.toFixed(8) + " m³";

    $("resultDensity").textContent =
        formatNumber(density, 2) + " g/cm³";

    $("tonnes").textContent =
        formatNumber(totalWeight / 1000, 4) +
        " metric tonnes";

    $("dimensions").textContent =
        "Material: " + materialName +
        " | Diameter: " +
        diameter + " " + currentUnit +
        " | Thickness: " +
        thickness + " " + currentUnit;

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
    ["diameter", "thickness"].forEach(id => {
        $(id).value = "";

        // Let the dimension-label engine restore the plain D / T labels.
        $(id).dispatchEvent(new Event("input", { bubbles: true }));
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

$("customDensity").addEventListener("input", () => {
    updateDensityDisplay();

    if (autoRecalculate) {
        calculateWeight();
    }
});

$("quantity").addEventListener("input", () => {
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

/* CALCULATION HISTORY CONFIG */

window.CALCULATOR_HISTORY_CONFIG = {
    calculatorName: "Circular Plate Weight Calculator",
    shapeName: "Circular Plate",
    sizeLabels: false,
    dimensions: [
        { key: "diameter", label: "Diameter (D)" },
        { key: "thickness", label: "Thickness (T)" }
    ],
    getCalculation: function () {
        return lastCalculation;
    }
};

/* MATERIAL DENSITY DISCLOSURE */

(function () {
    const toggle = $("circularPlateDensityToggle");
    const extraRows = document.querySelectorAll(".density-extra");

    if (!toggle || !extraRows.length) {
        return;
    }

    toggle.addEventListener("click", () => {
        const expanded =
            toggle.getAttribute("aria-expanded") === "true";
        const nextExpanded = !expanded;

        toggle.setAttribute("aria-expanded", String(nextExpanded));
        toggle.classList.toggle("is-open", nextExpanded);

        extraRows.forEach(row => {
            row.hidden = !nextExpanded;
        });
    });
})();

/* ==================================================
   CIRCULAR PLATE WEIGHT CALCULATOR JAVASCRIPT END
   This JavaScript file ends here.
================================================== */