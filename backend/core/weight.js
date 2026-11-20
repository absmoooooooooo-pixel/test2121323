/*
 * Shared weight maths.
 *
 * Every figure below is the exact expression the browser used before the
 * split. The multiplication order is kept on purpose: it produces bit-identical
 * floating point results, which is what the parity tests compare.
 *
 * Dimensions are in millimetres, density in g/cm³ unless noted.
 */
"use strict";

const MM3_PER_M3 = 1_000_000_000;
const MM3_G_CM3_TO_KG = 1_000_000;

/**
 * Volume (mm³) and density (g/cm³) -> volumes and weights.
 * 1,000,000,000 mm³ = 1 m³ and mm³ × g/cm³ / 1,000,000 = kg.
 */
function weightFromVolume(volumeMM3, density, quantity) {
    const volumeM3 = volumeMM3 / MM3_PER_M3;
    const singleWeight = (volumeMM3 * density) / MM3_G_CM3_TO_KG;
    const totalWeight = singleWeight * quantity;
    const totalTonnes = totalWeight / 1000;

    return {
        volumeMM3,
        volumeM3,
        singleWeight,
        totalWeight,
        totalTonnes
    };
}

/**
 * Dish ends use density in kg/m³:
 * weight = developed area (mm²) × thickness (mm) × density (kg/m³) / 10⁹.
 */
function weightFromAreaKgM3(areaMM2, thicknessMM, densityKgM3) {
    return (areaMM2 * thicknessMM * densityKgM3) / MM3_PER_M3;
}

function allFinite(values) {
    return values.every((value) => Number.isFinite(value));
}

module.exports = {
    weightFromVolume,
    weightFromAreaKgM3,
    allFinite,
    MM3_PER_M3,
    MM3_G_CM3_TO_KG
};
