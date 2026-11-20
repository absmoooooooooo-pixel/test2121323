/*
 * Request validation for the calculation API.
 *
 * The browser still validates its fields so the user sees the familiar,
 * field-level messages. This module is the server-side authority: it never
 * trusts the request body and rejects anything that is not a finite, in-range
 * number, an allowed unit, a whole quantity or a sane density.
 */
"use strict";

const INCH_TO_MM = 25.4;

class ValidationError extends Error {
    constructor(message, field, status = 400) {
        super(message);
        this.name = "ValidationError";
        this.field = field || null;
        this.status = status;
    }
}

const UNIT_FACTORS = Object.freeze({ mm: 1, in: INCH_TO_MM });

function unitFactor(unit) {
    if (!Object.prototype.hasOwnProperty.call(UNIT_FACTORS, unit)) {
        throw new ValidationError(
            'Unit must be "mm" or "in".',
            "unit"
        );
    }

    return UNIT_FACTORS[unit];
}

function toNumber(raw, label, field) {
    if (raw === null || raw === undefined) {
        throw new ValidationError(
            label + " is required. Please enter a valid positive number.",
            field
        );
    }

    if (typeof raw === "string" && raw.trim() === "") {
        throw new ValidationError(
            label + " is required. Please enter a valid positive number.",
            field
        );
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
        throw new ValidationError(
            label + " must be a number.",
            field
        );
    }

    return value;
}

/**
 * Reads the dimension fields declared by a calculator module.
 *
 * @param {object} payload  request body
 * @param {object} spec     { fields: [{ key, label, min, max, allowZero }] }
 * @returns {{ values: object, mm: object, factor: number }}
 */
function readDimensions(payload, spec) {
    const rawValues = payload && payload.values;

    if (!rawValues || typeof rawValues !== "object") {
        throw new ValidationError("Missing input values.", "values");
    }

    const factor = unitFactor(payload.unit || "mm");
    const values = {};
    const mm = {};

    for (const field of spec.fields) {
        const label = field.label || field.key;
        const value = toNumber(rawValues[field.key], label, field.key);

        const min = typeof field.min === "number" ? field.min : 0;

        if (field.allowZero) {
            if (value < min) {
                throw new ValidationError(
                    label + " must be " + min + " or more.",
                    field.key
                );
            }
        } else if (value <= min) {
            throw new ValidationError(
                label + " is required. Please enter a valid positive number.",
                field.key
            );
        }

        if (typeof field.max === "number" && value > field.max) {
            throw new ValidationError(
                label + " is too large for this calculator.",
                field.key
            );
        }

        values[field.key] = value;
        mm[field.key] = value * factor;
    }

    return { values, mm, factor, raw: rawValues };
}

function readQuantity(payload) {
    const raw = payload ? payload.quantity : undefined;
    const quantity = Number(raw === undefined ? 1 : raw);

    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
        throw new ValidationError(
            "Quantity must be a positive whole number.",
            "quantity"
        );
    }

    return quantity;
}

function readDensity(payload, options) {
    const opts = options || {};
    const min = typeof opts.min === "number" ? opts.min : 0.01;
    const max = typeof opts.max === "number" ? opts.max : 25000;
    const raw = payload ? payload.density : undefined;
    const density = Number(raw);

    if (!Number.isFinite(density) || density <= 0) {
        throw new ValidationError(
            "Invalid material density.",
            "density"
        );
    }

    if (density < min || density > max) {
        throw new ValidationError(
            "Material density is outside the supported range.",
            "density"
        );
    }

    return density;
}

/** Guards against overflow and NaN produced by extreme (but valid) input. */
function assertFinite(numbers) {
    for (const value of numbers) {
        if (!Number.isFinite(value)) {
            throw new ValidationError(
                "Values are too large to calculate safely.",
                null,
                422
            );
        }
    }
}

module.exports = {
    ValidationError,
    unitFactor,
    readDimensions,
    readQuantity,
    readDensity,
    assertFinite,
    INCH_TO_MM
};
