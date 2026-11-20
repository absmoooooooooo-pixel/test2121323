/* ==================================================
   FLANGE PLATE WEIGHT CALCULATOR JAVASCRIPT START
   Inputs, unit conversion, validation, formula, diagram drawing and result
   display for this calculator.
   Here is the complete logic, diagram and formula of this calculator.
================================================== */
"use strict";

/*
 * Flange Plate Weight Calculator
 *
 * Central density configuration:
 * All density values are stored in g/cm³.
 *
 * Net face area (mm²) =
 * (π / 4) × (OD² − ID² − N × HD²)
 *
 * Weight (kg) =
 * Net face area (mm²) × Thickness (mm) × Density (g/cm³) / 1,000,000
 */

const MATERIALS = window.MW_MATERIALS || {};

const $ = id => document.getElementById(id);

/* Dimension inputs, in keyboard navigation order. */
const FIELDS = [
    "od",
    "id",
    "thickness",
    "holes",
    "holeDiameter",
    "pcd"
];

/* The dimension fields that carry a length, so they are the only values that
   change when the measurement unit is switched. The bolt hole count, the
   quantity and the density are plain numbers and never convert. */
const UNIT_DIMENSION_FIELDS = [
    "od",
    "id",
    "thickness",
    "holeDiameter",
    "pcd"
];

/* Live value lines under the inputs: symbol, typed value and the unit on
   screen, for example "OD = 300 mm". */
const FIELD_READOUTS = [
    { input: "od", output: "fieldOd", symbol: "OD", unit: true },
    { input: "id", output: "fieldId", symbol: "ID", unit: true },
    { input: "thickness", output: "fieldThickness", symbol: "T", unit: true },
    { input: "holes", output: "fieldHoles", symbol: "N", unit: false },
    {
        input: "holeDiameter",
        output: "fieldHoleDiameter",
        symbol: "ØHD",
        unit: true
    },
    { input: "pcd", output: "fieldPcd", symbol: "PCD", unit: true }
];

/* Values used by the drawing while a field is still empty. */
const DIAGRAM_DEFAULTS = Object.freeze({
    od: 300,
    id: 150,
    thickness: 20,
    holes: 8,
    holeDiameter: 18,
    pcd: 240
});

/* Drawing box of the plan view (matches its 340 × 264 viewBox).
   Every coordinate and radius below is a fixed drawing coordinate. The view is
   schematic, so typing a value changes the labels and the number of bolt holes
   only: the flange never grows, shrinks, stretches or moves. */
const PLAN = Object.freeze({
    cx: 155,
    cy: 148,
    odRadius: 74,
    boreRadius: 34,
    pcdRadius: 59,
    holeRadius: 5,
    pcdDimY: 46,
    pcdExtendTop: 41,
    pcdLabelY: 37,
    leaderBendX: 250,
    leaderBendY: 210,
    calloutX: 336,
    calloutY: 203,
    titleX: 155,
    titleY: 252
});

/* Drawing box of the section view (matches its 340 × 264 viewBox).
   The cut is drawn with the flange axis horizontal: the outer diameter runs
   vertically, the plate thickness horizontally. These proportions are fixed
   drawing coordinates too, matching the schematic plan view above. */
const SECTION = Object.freeze({
    axisY: 140,
    odHalf: 74,
    boreHalf: 32,
    pcdHalf: 56,
    holeHalf: 5,
    left: 183,
    right: 225,
    odDimX: 125,
    odLabelX: 116,
    idDimX: 158,
    idLabelX: 149,
    tDimY: 52,
    tExtendTop: 47,
    tLabelY: 43,
    titleX: 204,
    titleY: 252
});

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
// DIAGRAM NUMBER HELPER START
// Short plain number for the SVG drawing (no unit, no trailing zeros).
// Here is the helper that shows numbers small and clear inside the diagram.
// ==================================================
function shortNumber(value) {
    const rounded = Math.round(value * 100) / 100;

    return String(rounded);
}
// ==================================================
// DIAGRAM NUMBER HELPER END
// This function ends here.
// ==================================================

// ==================================================
// UNIT CONVERSION NUMBER HELPER START
// Rounds a converted length and drops the trailing zeros, so the input field
// stays readable after a millimetre <-> inch switch.
// Here is the helper that keeps the converted numbers tidy.
// ==================================================
function trimNumber(value, decimals) {
    return String(Number(value.toFixed(decimals)));
}
// ==================================================
// UNIT CONVERSION NUMBER HELPER END
// This function ends here.
// ==================================================

// ==================================================
// DIAGRAM GEOMETRY HELPERS START
// Small helpers that keep the drawing proportions and leader angles valid.
// Here are the small functions that help with the calculation of the drawing.
// ==================================================
function clampValue(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function angularDistance(first, second) {
    const fullTurn = Math.PI * 2;
    const difference = Math.abs(first - second) % fullTurn;

    return difference > Math.PI ? fullTurn - difference : difference;
}

/* Splits the section width into solid spans after removing the bore and the
   bolt holes, so no seam is drawn across a blind flange and no negative
   width can reach the SVG. */
function solidSpans(halfWidth, gaps) {
    const merged = [];

    gaps
        .filter(gap => gap[1] - gap[0] > 0.5)
        .sort((first, second) => first[0] - second[0])
        .forEach(gap => {
            const last = merged[merged.length - 1];

            if (last && gap[0] <= last[1]) {
                last[1] = Math.max(last[1], gap[1]);
            } else {
                merged.push([gap[0], gap[1]]);
            }
        });

    const spans = [];
    let cursor = -halfWidth;

    merged.forEach(([from, to]) => {
        const start = Math.max(from, -halfWidth);
        const end = Math.min(to, halfWidth);

        if (start - cursor > 0.6) {
            spans.push([cursor, start]);
        }

        cursor = Math.max(cursor, end);
    });

    if (halfWidth - cursor > 0.6) {
        spans.push([cursor, halfWidth]);
    }

    return spans;
}
// ==================================================
// DIAGRAM GEOMETRY HELPERS END
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

    /* The same physical flange is kept on screen: the entered lengths are
       converted exactly once, when the unit changes, so nothing is converted
       twice and the drawing and the weight always describe the same part. */

    const factor = newUnit === "in" ? 1 / 25.4 : 25.4;
    const decimals = newUnit === "in" ? 5 : 3;

    UNIT_DIMENSION_FIELDS.forEach(id => {
        const raw = $(id).value.trim();

        if (raw === "") {
            return;
        }

        const value = Number(raw);

        if (!Number.isFinite(value)) {
            return;
        }

        $(id).value = trimNumber(value * factor, decimals);
    });

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
    renderDiagram();

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
        { id: "od", name: "Outer Diameter (OD)" },
        { id: "id", name: "Inner Diameter (ID)" },
        { id: "thickness", name: "Thickness (T)" },
        { id: "holeDiameter", name: "Bolt Hole Diameter (HD)" },
        { id: "pcd", name: "Bolt Hole Pitch Circle Diameter (PCD)" }
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
                " must be a number greater than zero.";
        }
    }

    const holesRaw = $("holes").value.trim();
    const holes = Number(holesRaw);

    if (
        holesRaw === "" ||
        !Number.isSafeInteger(holes) ||
        holes < 1
    ) {
        return "Number of Bolt Holes (N) must be a positive whole number.";
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

    /* GEOMETRY CHECKS */

    const outerValue = Number($("od").value);
    const innerValue = Number($("id").value);
    const thicknessValue = Number($("thickness").value);
    const holeDiameterValue = Number($("holeDiameter").value);
    const pcdValue = Number($("pcd").value);

    // OD must be larger than ID, otherwise there is no flange ring left.
    if (outerValue <= innerValue) {
        return "Outer Diameter (OD) must be greater than the Inner Diameter (ID).";
    }

    // The hole must stay clear of the bore: PCD/2 - HD/2 > ID/2.
    if (
        pcdValue / 2 - holeDiameterValue / 2 <=
        innerValue / 2 + 1e-9
    ) {
        return "Bolt holes overlap the central bore. PCD ÷ 2 − HD ÷ 2 must be greater than ID ÷ 2: increase the PCD, or reduce the Inner Diameter (ID) or the Bolt Hole Diameter (HD).";
    }

    // The hole must stay inside the rim: PCD/2 + HD/2 < OD/2.
    if (
        pcdValue / 2 + holeDiameterValue / 2 >=
        outerValue / 2 - 1e-9
    ) {
        return "Bolt holes cross the outside edge. PCD ÷ 2 + HD ÷ 2 must be less than OD ÷ 2: reduce the PCD or the Bolt Hole Diameter (HD), or increase the Outer Diameter (OD).";
    }

    // Neighbouring holes must not touch: chord between centres ≥ HD.
    if (holes > 1) {
        const chord = pcdValue * Math.sin(Math.PI / holes);

        if (chord < holeDiameterValue - 1e-9) {
            return "Adjacent bolt holes overlap. Reduce the Bolt Hole Diameter (HD) or the Number of Bolt Holes (N), or increase the PCD.";
        }
    }

    // Values large enough to be meaningless are rejected too.
    const values = [
        outerValue,
        innerValue,
        thicknessValue,
        pcdValue,
        holeDiameterValue
    ];

    if (values.some(value => value > 100000)) {
        return "One of the dimensions is too large for this calculator.";
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

    const od = Number($("od").value);
    const id = Number($("id").value);
    const thickness = Number($("thickness").value);
    const holes = Number($("holes").value);
    const holeDiameter = Number($("holeDiameter").value);
    const pcd = Number($("pcd").value);
    const quantity = Number($("quantity").value);

    // Density is always in g/cm³.
    const density = getDensity();

    // Convert entered dimensions to millimeters.
    const dimensionFactor = currentUnit === "in" ? 25.4 : 1;

    const odMM = od * dimensionFactor;
    const idMM = id * dimensionFactor;
    const thicknessMM = thickness * dimensionFactor;
    const holeDiameterMM = holeDiameter * dimensionFactor;
    const pcdMM = pcd * dimensionFactor;

    /*
     * Formula for dimensions in mm and density in g/cm³:
     *
     * Net area (mm²) = (π / 4) × (OD² − ID² − N × HD²)
     * Weight (kg) = Net area × T × Density / 1,000,000
     */

    /* Engineering formulas run on the backend (POST /api/calculate/flange-plate). */
    let calc;

    try {
        calc = await MWCalc.calculate("flange-plate", {
            values: { od: od, id: id, thickness: thickness, holes: holes, holeDiameter: holeDiameter, pcd: pcd },
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

    const { grossAreaMM2, holeAreaMM2, areaMM2, volumeMM3, volumeM3, singleWeight, totalWeight, removedPercent } = calc;

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
        od,
        id,
        thickness,
        holes,
        holeDiameter,
        pcd,
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
        " | OD: " + od + " " + currentUnit +
        " | ID: " + id + " " + currentUnit +
        " | T: " + thickness + " " + currentUnit;

    // How much of the face the bolt holes remove, shown for shop checks.

    $("holeDetails").textContent =
        "N = " + holes +
        " | HD = " + holeDiameter + " " + currentUnit +
        " | PCD = " + pcd + " " + currentUnit +
        " | Hole area removed: " + formatNumber(holeAreaMM2, 2) + " mm² of " +
        formatNumber(grossAreaMM2, 2) + " mm² gross face (" +
        formatNumber(removedPercent, 1) + "%)";

    $("results").style.display = "block";

    autoRecalculate = true;
}
// ==================================================
// WEIGHT CALCULATION FORMULA END
// This function ends here.
// ==================================================

/* ENGINEERING DIAGRAM */

// ==================================================
// DIAGRAM INPUT READER START
// Reads one field exactly as typed. Empty or invalid values fall back to a
// default so the drawing always shows a sensible flange.
// Here the input values are read for the diagram.
// ==================================================
function readDiagramInput(id) {
    const raw = $(id).value.trim();
    const value = Number(raw);

    if (raw === "" || !Number.isFinite(value) || value < 0) {
        return null;
    }

    return value;
}
// ==================================================
// DIAGRAM INPUT READER END
// This function ends here.
// ==================================================

// ==================================================
// DIAGRAM GEOMETRY START
// Converts the typed values into the proportions used by both drawings.
// Here the values are turned into the size used in the drawing.
// ==================================================
function diagramGeometry() {
    /* Values are read exactly as typed, in the unit on screen. The views are
       schematic, so these numbers are only used for the dimension text and the
       number of bolt holes; no drawing coordinate is derived from them. */
    const od = readDiagramInput("od");
    const id = readDiagramInput("id");
    const thickness = readDiagramInput("thickness");
    const holes = readDiagramInput("holes");
    const holeDiameter = readDiagramInput("holeDiameter");
    const pcd = readDiagramInput("pcd");

    // Empty fields fall back to the default flange so the schematic views
    // always draw a complete part. A label only prints its value when the
    // matching field really holds one.
    const shown = {
        od: od === null || od <= 0 ? DIAGRAM_DEFAULTS.od : od,
        id: id === null ? DIAGRAM_DEFAULTS.id : id,
        thickness: thickness === null ? DIAGRAM_DEFAULTS.thickness : thickness,
        holeDiameter: holeDiameter === null
            ? DIAGRAM_DEFAULTS.holeDiameter
            : holeDiameter,
        pcd: pcd === null ? DIAGRAM_DEFAULTS.pcd : pcd,
        holes: holes === null ? DIAGRAM_DEFAULTS.holes : holes
    };

    let holeCount = Math.round(shown.holes);

    if (!Number.isFinite(holeCount) || holeCount < 1) {
        holeCount = DIAGRAM_DEFAULTS.holes;
    }

    return {
        holes: Math.min(holeCount, 240),
        filled: {
            od: od !== null && od > 0,
            id: id !== null,
            thickness: thickness !== null,
            holeDiameter: holeDiameter !== null,
            pcd: pcd !== null,
            holes: holes !== null
        },
        shown: {
            od: shown.od,
            id: shown.id,
            pcd: shown.pcd,
            holeDiameter: shown.holeDiameter,
            thickness: shown.thickness,
            holes: holeCount
        }
    };
}

// ==================================================
// DIAGRAM GEOMETRY END
// This function ends here.
// ==================================================

// ==================================================
// PLAN VIEW DRAWING START
// Draws the flange from above in fixed drawing coordinates: outer circle,
// bore, dashed pitch circle, the bolt holes, both centre lines, the pitch
// circle dimension above the part and the bolt hole callout on the right.
// Only the labels and the bolt hole count come from the input fields.
// ==================================================
function buildPlanView(geometry) {
    const {
        cx, cy, odRadius, boreRadius, pcdRadius, holeRadius,
        pcdDimY, pcdExtendTop, pcdLabelY,
        leaderBendX, leaderBendY, calloutX, calloutY, titleX, titleY
    } = PLAN;

    /* BOLT HOLES. The pattern starts on the horizontal centre line, so the
       pitch circle dimension runs through the centres of two holes and the
       section can show the same holes cut through the plate. */
    const holeCount = clampValue(Math.round(geometry.holes), 1, 64);

    /* Drawn hole size. It stays fixed unless the pattern is so dense that the
       holes would touch: then they shrink just enough to stay separate. */
    const spacing = holeCount > 1
        ? 2 * pcdRadius * Math.sin(Math.PI / holeCount)
        : 2 * pcdRadius;

    const drawnHoleRadius = clampValue(
        Math.min(holeRadius, spacing * 0.4),
        1.1,
        holeRadius
    );

    const angles = [];

    for (let index = 0; index < holeCount; index++) {
        angles.push((index * 2 * Math.PI) / holeCount);
    }

    const solid = [];
    const centreLines = [];
    const dimensions = [];
    const leaders = [];
    const labels = [];

    /* OUTER CIRCLE, CENTRAL BORE AND PITCH CIRCLE. The dashed pitch circle is
       drawn before the holes, so every hole covers its own arc and the dashes
       stop cleanly at the hole edges. */

    solid.push(
        `<circle cx="${cx}" cy="${cy}" r="${odRadius}" class="flange-part"/>`
    );

    solid.push(
        `<circle cx="${cx}" cy="${cy}" r="${boreRadius}" class="flange-hole"/>`
    );

    solid.push(
        `<circle cx="${cx}" cy="${cy}" r="${pcdRadius}" class="flange-pitch-circle"/>`
    );

    angles.forEach(angle => {
        const holeX = cx + pcdRadius * Math.cos(angle);
        const holeY = cy + pcdRadius * Math.sin(angle);

        solid.push(
            `<circle cx="${holeX.toFixed(2)}" cy="${holeY.toFixed(2)}"` +
            ` r="${drawnHoleRadius.toFixed(2)}" class="flange-hole"/>`
        );
    });

    /* CENTRE LINES through the middle of the flange. */

    const overhang = 10;

    centreLines.push(
        `<line x1="${cx}" y1="${cy - odRadius - overhang}"` +
        ` x2="${cx}" y2="${cy + odRadius + overhang}" class="flange-centreline"/>`
    );

    centreLines.push(
        `<line x1="${cx - odRadius - overhang}" y1="${cy}"` +
        ` x2="${cx + odRadius + overhang}" y2="${cy}" class="flange-centreline"/>`
    );

    /* PCD DIMENSION, above the flange. Both extension lines start exactly on
       the intersections of the horizontal diameter with the dashed pitch
       circle, which is where the left and right bolt hole centres sit. */

    const pcdLeft = cx - pcdRadius;
    const pcdRight = cx + pcdRadius;

    dimensions.push(
        `<path d="M ${pcdLeft.toFixed(2)} ${cy} V ${pcdExtendTop}` +
        ` M ${pcdRight.toFixed(2)} ${cy} V ${pcdExtendTop}" class="flange-extension"/>`
    );

    dimensions.push(
        `<path d="M ${pcdLeft.toFixed(2)} ${pcdDimY} H ${pcdRight.toFixed(2)}"` +
        ` class="flange-dim-line" marker-start="url(#flangeArrow)"` +
        ` marker-end="url(#flangeArrow)"/>`
    );

    /* The value is written by the shared dimension values script, which turns
       the plain label into "PCD = 240" exactly like every other calculator
       drawing. The label is stable, so a value can never move it. */
    labels.push(
        `<text id="dimPCD" data-dim-stable x="${cx}" y="${pcdLabelY}"`
        + ` text-anchor="middle" class="flange-dim-label">PCD</text>`
    );

    /* BOLT HOLE CALLOUT, N x ØHD. The leader leaves the label, bends once and
       its arrowhead lands on the lower right bolt hole itself. */

    const boltTarget = Math.PI / 4;
    let boltAngle = angles[0];

    angles.forEach(angle => {
        if (angularDistance(angle, boltTarget) <
            angularDistance(boltAngle, boltTarget)) {
            boltAngle = angle;
        }
    });

    const boltX = cx + pcdRadius * Math.cos(boltAngle);
    const boltY = cy + pcdRadius * Math.sin(boltAngle);
    const towardsX = leaderBendX - boltX;
    const towardsY = leaderBendY - boltY;
    const towardsLength = Math.hypot(towardsX, towardsY) || 1;

    const tipX = boltX +
        ((drawnHoleRadius + 1) * towardsX) / towardsLength;
    const tipY = boltY +
        ((drawnHoleRadius + 1) * towardsY) / towardsLength;

    leaders.push(
        `<path d="M ${calloutX} ${leaderBendY} H ${leaderBendX}` +
        ` L ${tipX.toFixed(2)} ${tipY.toFixed(2)}" class="flange-leader"` +
        ` marker-end="url(#flangeArrow)"/>`
    );

    const boltText = geometry.filled.holes && geometry.filled.holeDiameter
        ? `${holeCount} × Ø${shortNumber(geometry.shown.holeDiameter)}`
        : "N × ØHD";

    labels.push(
        `<text x="${calloutX}" y="${calloutY}" text-anchor="end"` +
        ` class="flange-dim-label">${boltText}</text>`
    );

    /* VIEW TITLE */

    labels.push(
        `<text x="${titleX}" y="${titleY}" text-anchor="middle"` +
        ` class="flange-view-title">PLAN VIEW</text>`
    );

    return `<g class="flange-shape">${solid.join("")}</g>` +
        `<g class="flange-centrelines">${centreLines.join("")}</g>` +
        `<g class="flange-dimensions">${dimensions.join("")}</g>` +
        `<g class="flange-leaders">${leaders.join("")}</g>` +
        `<g class="flange-labels">${labels.join("")}</g>`;
}

// ==================================================
// PLAN VIEW DRAWING END
// This function ends here.
// ==================================================

// ==================================================
// SECTION VIEW DRAWING START
// Draws the flange cut through its centre, again in fixed drawing
// coordinates. The cutting plane is turned through the bolt hole pattern, so
// the holes appear as through openings in the same place as in the plan view.
// Only solid material is hatched; the bore and the holes stay white.
// ==================================================
function buildSectionView(geometry) {
    const {
        axisY, odHalf, boreHalf, pcdHalf, holeHalf, left, right,
        odDimX, odLabelX, idDimX, idLabelX,
        tDimY, tExtendTop, tLabelY, titleX, titleY
    } = SECTION;

    const width = right - left;
    const top = axisY - odHalf;
    const bottom = axisY + odHalf;
    const boreTop = axisY - boreHalf;
    const boreBottom = axisY + boreHalf;

    /* WHICH BOLT HOLES THE CUTTING PLANE PASSES THROUGH.
       The plan view puts a bolt hole on the horizontal centre line, so A-A
       always cuts that one. The opposite hole is only cut when the pattern
       really has a hole there, which keeps an odd hole count honest. */
    const holeCount = Math.max(1, Math.round(geometry.holes));
    const cutHoleCentres = [axisY - pcdHalf];

    if (holeCount % 2 === 0) {
        cutHoleCentres.push(axisY + pcdHalf);
    }

    /* ONE CONTINUOUS PLATE. The outer profile is a single rectangle, and the
       bore plus every cut bolt hole are cut out of it as openings that run
       right through the thickness. Both are sub paths of the same path, drawn
       with the even-odd rule, so the plate reads as one solid piece with real
       openings instead of separate blocks, and only the material is hatched. */

    const rectangle = (x, y, rectWidth, rectHeight) =>
        `M ${x.toFixed(2)} ${y.toFixed(2)}` +
        ` h ${rectWidth.toFixed(2)} v ${rectHeight.toFixed(2)}` +
        ` h ${(-rectWidth).toFixed(2)} Z`;

    const openings = [
        rectangle(left, boreTop, width, boreBottom - boreTop)
    ];

    cutHoleCentres.forEach(centreY => {
        openings.push(
            rectangle(left, centreY - holeHalf, width, holeHalf * 2)
        );
    });

    const solid =
        `<path d="${rectangle(left, top, width, bottom - top)}` +
        ` ${openings.join(" ")}" fill-rule="evenodd"` +
        ` class="flange-section-part"/>`;

    /* CENTRE LINES. The flange axis runs past both faces, and every cut bolt
       hole carries its own axis through the opening it makes. */

    const centreLines = [];

    centreLines.push(
        `<line x1="${(left - 10).toFixed(2)}" y1="${axisY}"` +
        ` x2="${(right + 10).toFixed(2)}" y2="${axisY}" class="flange-centreline"/>`
    );

    cutHoleCentres.forEach(holeAxisY => {
        centreLines.push(
            `<line x1="${(left - 8).toFixed(2)}" y1="${holeAxisY.toFixed(2)}"` +
            ` x2="${(right + 8).toFixed(2)}" y2="${holeAxisY.toFixed(2)}"` +
            ` class="flange-centreline"/>`
        );
    });

    /* DIMENSIONS. The outer diameter and the bore are dimensioned on the left
       in separate lanes, the thickness above the plate. The values themselves
       are written by the shared dimension values script, so every label keeps
       the "OD = 300" form used by the other calculators. */

    const dimensions = [];
    const labels = [];

    // Outer diameter.
    dimensions.push(
        `<path d="M ${(left - 4).toFixed(2)} ${top.toFixed(2)}` +
        ` H ${(odDimX + 4).toFixed(2)}` +
        ` M ${(left - 4).toFixed(2)} ${bottom.toFixed(2)}` +
        ` H ${(odDimX + 4).toFixed(2)}" class="flange-extension"/>`
    );

    dimensions.push(
        `<path d="M ${odDimX} ${top.toFixed(2)} V ${bottom.toFixed(2)}"` +
        ` class="flange-dim-line" marker-start="url(#flangeSectionArrow)"` +
        ` marker-end="url(#flangeSectionArrow)"/>`
    );

    labels.push(
        `<text id="dimOD" data-dim-stable x="${odLabelX}" y="${axisY}"` +
        ` text-anchor="middle" class="flange-dim-label"` +
        ` transform="rotate(-90 ${odLabelX} ${axisY})">OD</text>`
    );

    // Bore diameter.
    dimensions.push(
        `<path d="M ${(left - 4).toFixed(2)} ${boreTop.toFixed(2)}` +
        ` H ${(idDimX + 4).toFixed(2)}` +
        ` M ${(left - 4).toFixed(2)} ${boreBottom.toFixed(2)}` +
        ` H ${(idDimX + 4).toFixed(2)}" class="flange-extension"/>`
    );

    dimensions.push(
        `<path d="M ${idDimX} ${boreTop.toFixed(2)} V ${boreBottom.toFixed(2)}"` +
        ` class="flange-dim-line" marker-start="url(#flangeSectionArrow)"` +
        ` marker-end="url(#flangeSectionArrow)"/>`
    );

    labels.push(
        `<text id="dimID" data-dim-stable x="${idLabelX}" y="${axisY}"` +
        ` text-anchor="middle" class="flange-dim-label"` +
        ` transform="rotate(-90 ${idLabelX} ${axisY})">ID</text>`
    );

    // Thickness, above the plate.
    dimensions.push(
        `<path d="M ${left.toFixed(2)} ${(top - 4).toFixed(2)}` +
        ` V ${tExtendTop}` +
        ` M ${right.toFixed(2)} ${(top - 4).toFixed(2)}` +
        ` V ${tExtendTop}" class="flange-extension"/>`
    );

    dimensions.push(
        `<path d="M ${left.toFixed(2)} ${tDimY}` +
        ` H ${right.toFixed(2)}" class="flange-dim-line"` +
        ` marker-start="url(#flangeSectionArrow)"` +
        ` marker-end="url(#flangeSectionArrow)"/>`
    );

    labels.push(
        `<text id="dimT" data-dim-stable x="${((left + right) / 2).toFixed(2)}"` +
        ` y="${tLabelY}" text-anchor="middle" class="flange-dim-label">T</text>`
    );

    /* VIEW TITLE */

    labels.push(
        `<text x="${titleX}" y="${titleY}" text-anchor="middle"` +
        ` class="flange-view-title">SECTION A–A</text>`
    );

    return `<g class="flange-shape">${solid}</g>` +
        `<g class="flange-centrelines">${centreLines.join("")}</g>` +
        `<g class="flange-dimensions">${dimensions.join("")}</g>` +
        `<g class="flange-labels">${labels.join("")}</g>`;
}


// ==================================================
// SECTION VIEW DRAWING END
// This function ends here.
// ==================================================

// ==================================================
// DIAGRAM RENDER START
// Redraws both engineering views after every input change.
// Here the diagram is drawn again whenever an input changes.
// ==================================================
function renderFieldValues() {
    FIELD_READOUTS.forEach(item => {
        const input = $(item.input);
        const output = $(item.output);

        if (!input || !output) {
            return;
        }

        const raw = input.value.trim();
        const value = Number(raw);

        /* Only a real, non-negative number is shown. Clearing a field clears
           its line, so no NaN, undefined or stale value is ever left behind. */
        if (raw === "" || !Number.isFinite(value) || value < 0) {
            output.textContent = "";
            return;
        }

        output.textContent =
            item.symbol + " = " + raw + (item.unit ? " " + currentUnit : "");
    });
}

/* The shared dimension values script writes the values into the drawing
   labels. A redraw replaces those labels, so ask that script to place the
   values again (it is safe to call more than once). */
function syncDimensionValues() {
    if (typeof window.initDimensionValues === "function") {
        window.initDimensionValues([]);
    }
}

function renderDiagram() {
    const geometry = diagramGeometry();

    $("flangeTopDrawing").innerHTML = buildPlanView(geometry);
    $("flangeSectionDrawing").innerHTML = buildSectionView(geometry);

    /* Keep the value line under every input in step with the drawing. */
    renderFieldValues();

    /* A redraw replaces the labels, so the shared dimension values script
       has to write the values into the new labels again. This must happen on
       every redraw (hole count and hole diameter included), otherwise a
       change in one field would blank the values of the others. */
    syncDimensionValues();
}
// ==================================================
// DIAGRAM RENDER END
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
    renderDiagram();
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

// Every dimension field redraws the diagram immediately and recalculates
// once results are already on screen.
FIELDS.forEach(id => {
    $(id).addEventListener("input", () => {
        renderDiagram();

        if (autoRecalculate) {
            calculateWeight();
        }
    });
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
renderDiagram();

/* CALCULATION HISTORY CONFIG */

window.CALCULATOR_HISTORY_CONFIG = {
    calculatorName: "Flange Plate Weight Calculator",
    shapeName: "Flange Plate",
    sizeLabels: false,
    dimensions: [
        { key: "od", label: "Outer Diameter (OD)" },
        { key: "id", label: "Inner Diameter (ID)" },
        { key: "thickness", label: "Thickness (T)" },
        { key: "holes", label: "Number of Bolt Holes (N)", unit: false },
        { key: "holeDiameter", label: "Bolt Hole Diameter (HD)" },
        { key: "pcd", label: "Bolt Hole Pitch Circle Diameter (PCD)" }
    ],
    getCalculation: function () {
        return lastCalculation;
    }
};

/* MATERIAL DENSITY DISCLOSURE */

(function () {
    const toggle = $("flangeDensityToggle");
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
   FLANGE PLATE WEIGHT CALCULATOR JAVASCRIPT END
   This JavaScript file ends here.
================================================== */
