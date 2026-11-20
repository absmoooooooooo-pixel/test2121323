/*
 * Circular plate: a disc of diameter D and thickness T.
 *
 *   area   = (π / 4) × D²
 *   volume = area × T
 *
 * Ported from the original browser formula without changes.
 */
"use strict";

const { readDimensions, readQuantity, readDensity, assertFinite } = require("../core/validation");
const { weightFromVolume } = require("../core/weight");

const FIELDS = [
    { key: "diameter", label: "Diameter" },
    { key: "thickness", label: "Thickness" }
];

function compute(payload) {
    const { mm } = readDimensions(payload, { fields: FIELDS });
    const quantity = readQuantity(payload);
    const density = readDensity(payload);

    const areaMM2 = (Math.PI / 4) * mm.diameter * mm.diameter;
    const volumeMM3 = areaMM2 * mm.thickness;
    const weight = weightFromVolume(volumeMM3, density, quantity);

    assertFinite([areaMM2, weight.volumeM3, weight.singleWeight, weight.totalWeight]);

    return { areaMM2, ...weight };
}

module.exports = { FIELDS, compute };
