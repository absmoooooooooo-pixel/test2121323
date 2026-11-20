/*
 * Round bar: a solid cylinder of diameter D and length L.
 *
 *   volume = (π / 4) × D² × L
 *
 * Ported from the original browser formula without changes.
 */
"use strict";

const { readDimensions, readQuantity, readDensity, assertFinite } = require("../core/validation");
const { weightFromVolume } = require("../core/weight");

const FIELDS = [
    { key: "diameter", label: "Diameter" },
    { key: "length", label: "Length" }
];

function compute(payload) {
    const { mm } = readDimensions(payload, { fields: FIELDS });
    const quantity = readQuantity(payload);
    const density = readDensity(payload);

    const volumeMM3 =
        (Math.PI / 4) * mm.diameter * mm.diameter * mm.length;
    const weight = weightFromVolume(volumeMM3, density, quantity);

    assertFinite([weight.volumeM3, weight.singleWeight, weight.totalWeight]);

    return { ...weight };
}

module.exports = { FIELDS, compute };
