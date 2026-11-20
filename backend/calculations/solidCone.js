/*
 * Solid cone: base diameter D, height H.
 *
 *   volume = (1 / 3) × π × r² × H   with r = D / 2
 *
 * Ported from the original browser formula without changes.
 */
"use strict";

const { readDimensions, readQuantity, readDensity, assertFinite } = require("../core/validation");
const { weightFromVolume } = require("../core/weight");

const FIELDS = [
    { key: "diameter", label: "Diameter" },
    { key: "height", label: "Height" }
];

function compute(payload) {
    const { mm } = readDimensions(payload, { fields: FIELDS });
    const quantity = readQuantity(payload);
    const density = readDensity(payload);

    const radius = mm.diameter / 2;
    const volumeMM3 = (1 / 3) * Math.PI * radius * radius * mm.height;
    const weight = weightFromVolume(volumeMM3, density, quantity);

    assertFinite([weight.volumeM3, weight.singleWeight, weight.totalWeight]);

    return { ...weight };
}

module.exports = { FIELDS, compute };
