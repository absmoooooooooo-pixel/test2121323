/*
 * Calculation endpoint.
 *
 * POST /api/calculate/:calculator
 *   body: { values, unit, density, quantity, material?, type?, divisions? }
 *   200:  { ok: true, calculator, result }
 *   400:  { ok: false, error: { message, field } }
 *
 * The engineering formulas stay in backend/calculations; the response carries
 * only the finished numbers, which is exactly what the page renders.
 */
"use strict";

const calculators = require("../calculations");
const { SECTION_MATERIALS } = require("../materials/materialDensity");
const { ValidationError } = require("../core/validation");

function materialNameFor(payload) {
    const key = payload && payload.material;

    if (!key || key === "custom") {
        return "Custom Material";
    }

    const material = SECTION_MATERIALS[key];

    return material ? material.name : "Custom Material";
}

function calculate(slug, payload) {
    const calculator = calculators.get(slug);

    if (!calculator) {
        throw new ValidationError("Unknown calculator: " + slug, null, 404);
    }

    const result = calculator.compute(payload || {});
    const body = payload || {};

    /* Dish ends already carry their own material name (kg/m³ table). */
    if (body.type === undefined) {
        result.materialName = materialNameFor(body);
    }

    return {
        ok: true,
        calculator: slug,
        units: {
            dimensions: body.unit === "in" ? "in" : "mm",
            density: body.type === undefined ? "g/cm3" : "kg/m3"
        },
        result
    };
}

function list() {
    return {
        ok: true,
        count: calculators.list().length,
        calculators: calculators.list()
    };
}

module.exports = { calculate, list };
