/* ==================================================
   T CHANNEL WEIGHT CALCULATOR JAVASCRIPT START
   Inputs, unit conversion, validation, formula and result display for this calculator.
   Here is the complete logic and the formula of this calculator.
================================================== */
"use strict";

/*
 * T Channel Weight Calculator
 *
 * T channel with external overall height H and flange width B.
 * The flange is full width, and the web runs below it, so the
 * junction is counted once.
 *
 * Area = B × Tf + (H − Tf) × Tw.
 * Weight (kg) = area (mm²) × length (mm) × density (g/cm³)
 * / 1,000,000.
 *
 * All dimensions are converted to millimeters before calculating.
 * Density is always in g/cm³.
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

/* 1 inch = 25.4 millimeters. */
const INCH_TO_MM = 25.4;

/* Dimension inputs, in mobile keyboard navigation order. */
const FIELDS = [
    "h",
    "b",
    "tw",
    "tf",
    "length"
];

const FIELD_NAMES = [
    {
        "id": "h",
        "name": "Overall Height"
    },
    {
        "id": "b",
        "name": "Flange Width"
    },
    {
        "id": "tw",
        "name": "Web Thickness"
    },
    {
        "id": "tf",
        "name": "Flange Thickness"
    },
    {
        "id": "length",
        "name": "Length"
    }
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
// FUNCTION: GET AREA M M START
// This function performs the get area m m step of this calculator.
// This is where this function's work happens.
// ==================================================
function getAreaMM(d) {
    return d.b * d.tf + (d.h - d.tf) * d.tw;
}
// ==================================================
// FUNCTION: GET AREA M M END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: VALIDATE SHAPE START
// This function performs the validate shape step of this calculator.
// This is where this function's work happens.
// ==================================================
function validateShape(d) {
    if (d.tw >= d.b) {
        return "Web thickness must be less than the flange width.";
    }

    if (d.tf >= d.h) {
        return "Flange thickness must be less than the overall height.";
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
    return "H: " + formatDimension(d.h) + " " + unit +
        " | B: " + formatDimension(d.b) + " " + unit +
        " | Tw: " + formatDimension(d.tw) + " " + unit +
        " | Tf: " + formatDimension(d.tf) + " " + unit +
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
function calculateWeight() {
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

    const areaMM2 = getAreaMM(mm);
    const lengthMM = mm.length;
    const volumeMM3 = areaMM2 * lengthMM;

    // 1,000,000,000 mm³ = 1 m³.
    const volumeM3 = volumeMM3 / 1_000_000_000;

    // mm³ × g/cm³ / 1,000,000 = kg.
    const singleWeight = (volumeMM3 * density) / 1_000_000;
    const totalWeight = singleWeight * quantity;

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
    calculatorName: "T Channel Weight Calculator",
    shapeName: "T Channel",
    sizeLabels: true,
    dimensions: [
        { key: "h", label: "Overall Height (H)" },
        { key: "b", label: "Flange Width (B)" },
        { key: "tw", label: "Web Thickness (Tw)" },
        { key: "tf", label: "Flange Thickness (Tf)" },
        { key: "length", label: "Length (L)" }
    ],
    getCalculation: function () {
        return lastCalculation;
    }
};

/* MATERIAL DENSITY DISCLOSURE (auto) */
(function () {
    const toggle = document.getElementById("tChannelDensityToggle");
    const table = document.getElementById("tChannelDensityTable");
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
   T CHANNEL WEIGHT CALCULATOR JAVASCRIPT END
   This JavaScript file ends here.
================================================== */