/*
 * Flange plate with a central bore and a ring of bolt holes.
 *
 *   gross area = (π / 4) × (OD² − ID²)
 *   hole area  = N × (π / 4) × HD²
 *   net area   = gross area − hole area
 *   volume     = net area × T
 *
 * Ported from the original browser formula without changes, including the
 * geometry checks that reject overlapping holes.
 */
"use strict";

const { readDimensions, readQuantity, readDensity, assertFinite, ValidationError } = require("../core/validation");
const { weightFromVolume } = require("../core/weight");

const FIELDS = [
    { key: "od", label: "Outer diameter" },
    { key: "id", label: "Inner diameter" },
    { key: "thickness", label: "Thickness" },
    { key: "holeDiameter", label: "Bolt hole diameter" },
    { key: "pcd", label: "Bolt hole pitch circle diameter" }
];

function compute(payload) {
    const { mm, values, factor } = readDimensions(payload, { fields: FIELDS });
    const quantity = readQuantity(payload);
    const density = readDensity(payload);

    const holes = Number(payload && payload.values ? payload.values.holes : NaN);

    if (!Number.isSafeInteger(holes) || holes < 1) {
        throw new ValidationError(
            "Number of bolt holes must be a positive whole number.",
            "holes"
        );
    }

    if ([values.od, values.id, values.thickness, values.pcd, values.holeDiameter]
        .some((value) => value > 100000 || value * factor > 100000 * factor)) {
        throw new ValidationError("One of the dimensions is too large for this calculator.");
    }

    /* GEOMETRY CHECKS (same rules as the browser, evaluated on millimetres) */
    if (mm.od <= mm.id) {
        throw new ValidationError(
            "Outer diameter must be greater than the inner diameter."
        );
    }

    if (mm.pcd / 2 - mm.holeDiameter / 2 <= mm.id / 2 + 1e-9) {
        throw new ValidationError(
            "Bolt holes overlap the central bore. Increase the PCD, or reduce the inner diameter or the bolt hole diameter."
        );
    }

    if (mm.pcd / 2 + mm.holeDiameter / 2 >= mm.od / 2 - 1e-9) {
        throw new ValidationError(
            "Bolt holes cross the outside edge. Reduce the PCD or the bolt hole diameter, or increase the outer diameter."
        );
    }

    if (holes > 1) {
        const chord = mm.pcd * Math.sin(Math.PI / holes);

        if (chord < mm.holeDiameter - 1e-9) {
            throw new ValidationError(
                "Adjacent bolt holes overlap. Reduce the bolt hole diameter or the number of holes, or increase the PCD."
            );
        }
    }

    /* Full annular face (disc minus bore) before the bolt holes. */
    const grossAreaMM2 =
        (Math.PI / 4) * (mm.od * mm.od - mm.id * mm.id);

    /* One bolt hole removes a circle of π/4 × HD². */
    const holeAreaMM2 =
        holes * (Math.PI / 4) * mm.holeDiameter * mm.holeDiameter;

    const areaMM2 = grossAreaMM2 - holeAreaMM2;
    const volumeMM3 = areaMM2 * mm.thickness;
    const weight = weightFromVolume(volumeMM3, density, quantity);

    const removedPercent = grossAreaMM2 > 0
        ? (holeAreaMM2 / grossAreaMM2) * 100
        : 0;

    assertFinite([
        grossAreaMM2,
        holeAreaMM2,
        areaMM2,
        weight.volumeM3,
        weight.singleWeight,
        weight.totalWeight
    ]);

    return {
        holes,
        grossAreaMM2,
        holeAreaMM2,
        areaMM2,
        removedPercent,
        ...weight
    };
}

module.exports = { FIELDS, compute };
