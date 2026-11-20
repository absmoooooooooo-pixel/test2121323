/*
 * Prismatic section calculators.
 *
 * Every calculator in this file is "constant cross-section × length":
 *
 *   volume (mm³) = area (mm²) × length (mm)
 *
 * The area expressions are ported verbatim from the original browser code, so
 * the results are identical for identical input. Nothing here is rounded.
 */
"use strict";

const { readDimensions, readQuantity, readDensity, assertFinite, ValidationError } = require("../core/validation");
const { weightFromVolume } = require("../core/weight");

const LENGTH = { key: "length", label: "Length" };

/* ------------------------------------------------------------------ *
 * Cross-section area formulas (dimensions already in millimetres)
 * ------------------------------------------------------------------ */
const SHAPES = {
    "plate": {
        fields: [
            { key: "width", label: "Width" },
            { key: "thickness", label: "Thickness" },
            LENGTH
        ],
        area: (d) => d.width * d.thickness
    },

    "box-channel": {
        fields: [
            { key: "b", label: "Width" },
            { key: "h", label: "Height" },
            { key: "t", label: "Thickness" },
            LENGTH
        ],
        area: (d) => {
            const innerWidth = d.b - 2 * d.t;
            const innerHeight = d.h - 2 * d.t;
            return d.b * d.h - innerWidth * innerHeight;
        },
        validate: (d) => (
            d.t * 2 >= d.b || d.t * 2 >= d.h
                ? "Wall thickness must be less than half of both outer dimensions."
                : ""
        )
    },

    "c-channel": {
        fields: [
            { key: "h", label: "Height" },
            { key: "b", label: "Flange width" },
            { key: "tw", label: "Web thickness" },
            { key: "tf", label: "Flange thickness" },
            LENGTH
        ],
        area: (d) => d.h * d.tw + 2 * (d.b - d.tw) * d.tf,
        validate: (d) => {
            if (d.tw >= d.b) {
                return "Web thickness must be less than the flange width.";
            }
            if (d.tf * 2 >= d.h) {
                return "Flange thickness must be less than half the overall height.";
            }
            return "";
        }
    },

    "e-section": {
        fields: [
            { key: "h", label: "Height" },
            { key: "b", label: "Overall width" },
            { key: "tw", label: "Web thickness" },
            { key: "tf", label: "Flange thickness" },
            LENGTH
        ],
        area: (d) => d.h * d.tw + 3 * (d.b - d.tw) * d.tf,
        validate: (d) => {
            if (d.tw >= d.b) {
                return "Web thickness must be less than the overall width.";
            }
            if (d.tf * 3 >= d.h) {
                return "Flange thickness must be less than one-third of the overall height.";
            }
            return "";
        }
    },

    "i-channel": {
        fields: [
            { key: "h", label: "Height" },
            { key: "b", label: "Flange width" },
            { key: "tw", label: "Web thickness" },
            { key: "tf", label: "Flange thickness" },
            LENGTH
        ],
        area: (d) => 2 * d.b * d.tf + (d.h - 2 * d.tf) * d.tw,
        validate: (d) => {
            if (d.tw >= d.b) {
                return "Web thickness must be less than the flange width.";
            }
            if (d.tf * 2 >= d.h) {
                return "Flange thickness must be less than half the overall height.";
            }
            return "";
        }
    },

    "t-channel": {
        fields: [
            { key: "h", label: "Height" },
            { key: "b", label: "Flange width" },
            { key: "tw", label: "Web thickness" },
            { key: "tf", label: "Flange thickness" },
            LENGTH
        ],
        area: (d) => d.b * d.tf + (d.h - d.tf) * d.tw,
        validate: (d) => {
            if (d.tw >= d.b) {
                return "Web thickness must be less than the flange width.";
            }
            if (d.tf >= d.h) {
                return "Flange thickness must be less than the overall height.";
            }
            return "";
        }
    },

    "l-channel": {
        fields: [
            { key: "legA", label: "Leg A" },
            { key: "legB", label: "Leg B" },
            { key: "t", label: "Thickness" },
            LENGTH
        ],
        area: (d) => d.legA * d.t + (d.legB - d.t) * d.t,
        validate: (d) => (
            d.t >= d.legA || d.t >= d.legB
                ? "Thickness must be less than both leg dimensions."
                : ""
        )
    },

    "pipe": {
        fields: [
            { key: "od", label: "Outer diameter" },
            { key: "wall", label: "Wall thickness" },
            LENGTH
        ],
        area: (d) => {
            const innerDiameter = d.od - 2 * d.wall;
            return (Math.PI / 4) * (d.od * d.od - innerDiameter * innerDiameter);
        },
        validate: (d) => (
            d.wall * 2 >= d.od
                ? "Wall thickness must be less than half the outer diameter."
                : ""
        )
    },

    "shell": {
        fields: [
            { key: "od", label: "Outer diameter" },
            { key: "thickness", label: "Thickness" },
            LENGTH
        ],
        /* π × (OD × T − T²) is identical to π/4 × (OD² − ID²) with ID = OD − 2T. */
        area: (d) => Math.PI * (d.od * d.thickness - d.thickness * d.thickness),
        validate: (d) => {
            if (d.thickness * 2 >= d.od) {
                return "Thickness must be less than half of the outer diameter.";
            }
            if (!(d.od - 2 * d.thickness > 0)) {
                return "The calculated inner diameter is not valid. Reduce the thickness.";
            }
            return "";
        }
    },

    "hexagon-bar": {
        fields: [
            { key: "a", label: "Across flats" },
            LENGTH
        ],
        area: (d) => (Math.sqrt(3) / 2) * d.a * d.a
    },

    "hexagonal-bar-with-round-hole": {
        fields: [
            { key: "a", label: "Across flats" },
            { key: "d", label: "Hole diameter" },
            LENGTH
        ],
        area: (d) => {
            const areaOuter = (Math.sqrt(3) / 2) * d.a * d.a;
            const areaHole = (Math.PI / 4) * d.d * d.d;
            return areaOuter - areaHole;
        },
        validate: (d) => (
            d.d >= d.a
                ? "Hole diameter must be less than the outer across-flats dimension."
                : ""
        )
    },

    "round-bar-with-hexagonal-hole": {
        fields: [
            { key: "diameter", label: "Outer diameter" },
            { key: "a", label: "Hex across flats" },
            LENGTH
        ],
        area: (d) => {
            const areaOuter = (Math.PI / 4) * d.diameter * d.diameter;
            const areaHole = (Math.sqrt(3) / 2) * d.a * d.a;
            return areaOuter - areaHole;
        },
        validate: (d) => {
            /* A regular hexagon with across-flats A fits inside a circle of
               diameter D when A / √3 ≤ D / 2. */
            const maxAcrossFlats = (Math.sqrt(3) / 2) * d.diameter;
            return d.a > maxAcrossFlats
                ? "Hexagonal hole across-flats is too large for the outer diameter."
                : "";
        }
    },

    "square-bar": {
        fields: [
            { key: "a", label: "Side A" },
            { key: "b", label: "Side B" },
            LENGTH
        ],
        area: (d) => d.a * d.b
    },

    "trapezium-bar": {
        fields: [
            { key: "a", label: "Parallel side A" },
            { key: "b", label: "Parallel side B" },
            { key: "h", label: "Height" },
            LENGTH
        ],
        area: (d) => ((d.a + d.b) / 2) * d.h
    },

    "trapezoidal-bar": {
        fields: [
            { key: "a", label: "Parallel side A" },
            { key: "b", label: "Parallel side B" },
            { key: "h", label: "Height" },
            LENGTH
        ],
        area: (d) => ((d.a + d.b) / 2) * d.h
    },

    "triangular-bar": {
        fields: [
            { key: "b", label: "Base" },
            { key: "h", label: "Height" },
            LENGTH
        ],
        area: (d) => (d.b * d.h) / 2
    }
};

/**
 * Generic prismatic calculation.
 * @returns {{ areaMM2:number, volumeMM3:number, volumeM3:number,
 *            singleWeight:number, totalWeight:number, totalTonnes:number }}
 */
function compute(slug, payload) {
    const shape = SHAPES[slug];

    if (!shape) {
        throw new ValidationError("Unknown calculator: " + slug, null, 404);
    }

    const { mm } = readDimensions(payload, { fields: shape.fields });
    const quantity = readQuantity(payload);
    const density = readDensity(payload);

    if (shape.fields.some((field) => !(mm[field.key] > 0))) {
        throw new ValidationError("Every dimension must be greater than zero.");
    }

    const shapeError = shape.validate ? shape.validate(mm) : "";

    if (shapeError) {
        throw new ValidationError(shapeError);
    }

    const areaMM2 = shape.area(mm);
    const volumeMM3 = areaMM2 * mm.length;
    const weight = weightFromVolume(volumeMM3, density, quantity);

    assertFinite([areaMM2, weight.volumeM3, weight.singleWeight, weight.totalWeight]);

    return {
        areaMM2,
        ...weight
    };
}

module.exports = {
    SHAPES,
    compute,
    slugs: Object.keys(SHAPES)
};
