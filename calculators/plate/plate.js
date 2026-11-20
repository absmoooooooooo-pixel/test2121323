/* ==================================================
   PLATE WEIGHT CALCULATOR JAVASCRIPT START
   Inputs, unit conversion, validation, formula and result display for this calculator.
   Here is the complete logic and the formula of this calculator.
================================================== */
"use strict";

/*
 * Plate Weight Calculator
 *
 * Central density configuration:
 * All density values are stored in g/cm³.
 *
 * Weight (kg) =
 * Width (mm) × Thickness (mm) × Length (mm)
 * × Density (g/cm³) / 1,000,000
 */

const MATERIALS = window.MW_MATERIALS || {};

const $ = id => document.getElementById(id);

/* Dimension inputs, in mobile keyboard navigation order. */
const FIELDS = [
    "width",
    "thickness",
    "length"
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
        { id: "width", name: "Width" },
        { id: "thickness", name: "Thickness" },
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

    const width = Number($("width").value);
    const thickness = Number($("thickness").value);
    const length = Number($("length").value);
    const quantity = Number($("quantity").value);

    // Density is always in g/cm³.
    const density = getDensity();

    // Convert entered dimensions to millimeters.
    const dimensionFactor = currentUnit === "in" ? 25.4 : 1;

    const widthMM = width * dimensionFactor;
    const thicknessMM = thickness * dimensionFactor;
    const lengthMM = length * dimensionFactor;

    /*
     * Formula for dimensions in mm and density in g/cm³:
     *
     * Weight (kg) =
     * W(mm) × T(mm) × L(mm) × Density(g/cm³) / 1,000,000
     */

    /* Engineering formulas run on the backend (POST /api/calculate/plate). */
    let calc;

    try {
        calc = await MWCalc.calculate("plate", {
            values: { width: width, thickness: thickness, length: length },
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
        width,
        thickness,
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
        " | Dimensions: " +
        width + " × " +
        thickness + " × " +
        length + " " + currentUnit;

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
    ["width", "thickness", "length"].forEach(id => {
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
    calculatorName: "Plate Weight Calculator",
    shapeName: "Plate",
    sizeLabels: false,
    dimensions: [
        { key: "length", label: "Length (L)" },
        { key: "width", label: "Width (W)" },
        { key: "thickness", label: "Thickness (T)" }
    ],
    getCalculation: function () {
        return lastCalculation;
    }
};

/* MATERIAL DENSITY DISCLOSURE */

(function () {
    const toggle = $("densityToggle");
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
   PLATE WEIGHT CALCULATOR JAVASCRIPT END
   This JavaScript file ends here.
================================================== */