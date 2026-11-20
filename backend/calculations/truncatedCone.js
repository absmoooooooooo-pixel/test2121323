/*
 * Truncated cone made from plate: large end D, small end d, height H and
 * plate thickness T.
 *
 *   slant        = √(H² + (R − r)²)
 *   surface area = π × (R + r) × slant
 *   plate volume = surface area × T
 *
 * The weight is the weight of that plate, not a solid frustum.
 * Ported from the original browser formula without changes.
 */
"use strict";

const { readDimensions, readQuantity, readDensity, assertFinite, ValidationError } = require("../core/validation");
const { weightFromVolume } = require("../core/weight");

const FIELDS = [
    { key: "largeDiameter", label: "Large end diameter" },
    { key: "smallDiameter", label: "Small end diameter" },
    { key: "height", label: "Height" },
    { key: "thickness", label: "Plate thickness" }
];

function geometry(d) {
    const largeRadius = d.largeDiameter / 2;
    const smallRadius = d.smallDiameter / 2;
    const slantHeight = Math.sqrt(
        d.height * d.height +
        Math.pow(largeRadius - smallRadius, 2)
    );
    const surfaceArea = Math.PI * (largeRadius + smallRadius) * slantHeight;
    const plateVolume = surfaceArea * d.thickness;

    return {
        largeRadius,
        smallRadius,
        slantHeight,
        surfaceArea,
        plateVolume
    };
}

function compute(payload) {
    const { mm, factor } = readDimensions(payload, { fields: FIELDS });
    const quantity = readQuantity(payload);
    const density = readDensity(payload);

    if (mm.smallDiameter >= mm.largeDiameter) {
        throw new ValidationError(
            "Small end diameter must be less than the large end diameter."
        );
    }

    if (mm.thickness * 2 >= mm.smallDiameter) {
        throw new ValidationError(
            "Plate thickness must be less than half the small end diameter."
        );
    }

    const shape = geometry(mm);

    /* 1,000,000 mm² = 1 m², and 1,000,000,000 mm³ = 1 m³. */
    const surfaceAreaM2 = shape.surfaceArea / 1_000_000;
    const weight = weightFromVolume(shape.plateVolume, density, quantity);

    assertFinite([
        shape.slantHeight,
        surfaceAreaM2,
        weight.volumeM3,
        weight.singleWeight,
        weight.totalWeight,
        weight.totalTonnes
    ]);

    return {
        slantHeightMM: shape.slantHeight,
        /* The screen shows the slant in the unit the user typed in. */
        slantHeight: shape.slantHeight / factor,
        surfaceAreaMM2: shape.surfaceArea,
        surfaceAreaM2,
        volumeMM3: shape.plateVolume,
        ...weight
    };
}

module.exports = { FIELDS, compute, geometry };
