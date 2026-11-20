/*
 * Dish ends — five head types with their own geometry.
 *
 *   flat          crown πR² + straight flange 2πR·SF
 *   torispherical knuckle torus + spherical crown + flange
 *   ellipsoidal   oblate spheroid area (closed form) + flange
 *   hemispherical 2πR² + flange
 *   template      ellipsoidal area, plus the blank stations for marking out
 *
 * Weight uses density in kg/m³:
 *   W = developed area (mm²) × thickness (mm) × ρ (kg/m³) ÷ 10⁹
 *
 * Every expression below is the original browser expression, unchanged.
 */
"use strict";

const { readQuantity, readDensity, assertFinite, ValidationError } = require("../core/validation");
const { weightFromAreaKgM3 } = require("../core/weight");

const TYPES = Object.freeze(["flat", "torispherical", "ellipsoidal", "hemispherical", "template"]);

/* Field sets per head type (millimetres). */
const TYPE_FIELDS = Object.freeze({
    flat: ["id", "kr", "sf", "t"],
    torispherical: ["id", "kr", "sf", "t"],
    ellipsoidal: ["id", "h", "sf", "t"],
    hemispherical: ["id", "sf", "t"],
    template: ["id", "h", "sf", "t"]
});

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ *
 * Geometry helpers (ported verbatim)
 * ------------------------------------------------------------------ */

function torispherical(R, CR, KR) {
    const spread = CR - KR;
    const ratio = clamp((R - KR) / spread, 0, 1);
    const thetaC = Math.asin(ratio);
    const thetaK = Math.PI / 2 - thetaC;
    const H = CR - Math.sqrt(Math.max(0, spread * spread - (R - KR) * (R - KR)));
    const aKnuckle = 2 * Math.PI * KR * ((R - KR) * thetaK + KR * Math.sin(thetaK));
    const aCrown = 2 * Math.PI * CR * (H - KR * Math.sin(thetaK));

    return { thetaC, thetaK, H, aKnuckle, aCrown };
}

function ellipsoidDishArea(a, b) {
    if (Math.abs(a - b) < 1e-9) {
        return 2 * Math.PI * a * a;
    }
    if (a > b) {
        const e = Math.sqrt(1 - (b * b) / (a * a));
        return Math.PI * a * a + (Math.PI * b * b / (2 * e)) * Math.log((1 + e) / (1 - e));
    }
    const ep = Math.sqrt(1 - (a * a) / (b * b));
    return Math.PI * a * a + (Math.PI * a * b / ep) * Math.asin(ep);
}

function meridianArc(R, H, t) {
    const steps = 160;
    let sum = 0;
    const f = (u) => Math.hypot(R * Math.cos(u), H * Math.sin(u));

    for (let i = 0; i < steps; i++) {
        const u0 = (t * i) / steps;
        const u1 = (t * (i + 1)) / steps;
        const um = (u0 + u1) / 2;
        sum += ((f(u0) + 4 * f(um) + f(u1)) * (u1 - u0)) / 6;
    }

    return sum;
}

function buildStations(R, H, n, blankR) {
    const step = (2 * Math.PI) / n;
    const rows = [];

    for (let i = 0; i <= n / 2; i++) {
        const phi = i * step;
        const x = R * Math.cos(phi);
        const r = Math.abs(x);
        const t = Math.asin(clamp(r / R, 0, 1));

        rows.push({
            index: i,
            angle: (phi * 180) / Math.PI,
            planRadius: r,
            height: H * Math.cos(t),
            meridian: meridianArc(R, H, t),
            bx: blankR * Math.sin(phi),
            by: blankR * Math.cos(phi)
        });
    }

    return rows;
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */

function readInput(payload) {
    const type = payload && payload.type;

    if (TYPES.indexOf(type) === -1) {
        throw new ValidationError("Unknown dish end type.", "type");
    }

    const raw = payload && payload.values;

    if (!raw || typeof raw !== "object") {
        throw new ValidationError("Missing input values.", "values");
    }

    const factor = payload.unit === "in" ? 25.4 : 1;
    const num = (key, label) => {
        const value = Number(raw[key]);

        if (!Number.isFinite(value)) {
            throw new ValidationError(label + " must be a number.", key);
        }

        return value * factor;
    };

    const id = num("id", "Inside diameter");
    const t = num("t", "Thickness");
    const R = id / 2;
    const sf = raw.sf === undefined || raw.sf === null || raw.sf === ""
        ? 0
        : num("sf", "Straight face");

    if (!(id > 0)) {
        throw new ValidationError("Enter the dish inside diameter (ID).", "id");
    }
    if (!(t > 0)) {
        throw new ValidationError("Enter the dish thickness (T).", "t");
    }
    if (t >= R) {
        throw new ValidationError("Thickness must be smaller than the inside radius (ID ÷ 2).", "t");
    }
    if (!(sf >= 0)) {
        throw new ValidationError("Straight face must be zero or a positive number.", "sf");
    }

    let kr = 0;
    let h = 0;

    if (type === "flat" || type === "torispherical") {
        kr = num("kr", "Knuckle radius");
        if (!(kr > 0)) {
            throw new ValidationError("Enter the dish knuckle radius (R).", "kr");
        }
        if (kr >= R) {
            throw new ValidationError("Knuckle radius must be smaller than the inside radius (ID ÷ 2).", "kr");
        }
    }

    if (type === "ellipsoidal" || type === "template") {
        h = num("h", "Dish height");
        if (!(h > 0)) {
            throw new ValidationError("Enter the dish total height (H).", "h");
        }
        if (h > id) {
            throw new ValidationError("Dish height must not exceed the inside diameter (ID).", "h");
        }
    }

    const density = readDensity(payload, { min: 1, max: 25000 });
    const quantity = readQuantity(payload);

    let divisions = payload.divisions;

    if (type === "template") {
        divisions = Number(divisions === undefined ? 12 : divisions);
        if (!Number.isSafeInteger(divisions) || divisions < 4 || divisions > 360 || divisions % 2 !== 0) {
            throw new ValidationError("Number of divisions must be an even whole number of at least 4.", "divisions");
        }
    }

    return {
        type,
        id,
        sf,
        t,
        kr,
        h,
        density,
        quantity,
        divisions: type === "template" ? divisions : null,
        materialName: typeof payload.materialName === "string" ? payload.materialName : ""
    };
}

/* ------------------------------------------------------------------ *
 * Calculation
 * ------------------------------------------------------------------ */

function compute(input) {
    const type = input.type;
    const R = input.id / 2;
    const T = input.t;
    const SF = input.sf;
    let H = 0;
    let CR = null;
    let KR = null;
    let thetaC = null;
    let thetaK = null;
    let dishArea = 0;
    let meridian = 0;

    if (type === "flat") {
        H = 0;
        KR = input.kr;
        dishArea = Math.PI * R * R;
        meridian = R;
    } else if (type === "torispherical") {
        CR = input.id;
        KR = input.kr;
        const g = torispherical(R, CR, KR);
        H = g.H;
        thetaC = g.thetaC;
        thetaK = g.thetaK;
        dishArea = g.aKnuckle + g.aCrown;
        meridian = KR * g.thetaK + CR * g.thetaC;
    } else if (type === "hemispherical") {
        H = R;
        CR = R;
        dishArea = 2 * Math.PI * R * R;
        meridian = (Math.PI * R) / 2;
    } else {
        H = input.h;
        dishArea = ellipsoidDishArea(R, H);
        meridian = meridianArc(R, H, Math.PI / 2);
    }

    const faceArea = 2 * Math.PI * R * SF;
    const areaTotal = dishArea + faceArea;
    const blankDia = 2 * Math.sqrt(areaTotal / Math.PI);
    const blankArea = (Math.PI * blankDia * blankDia) / 4;
    const weight = weightFromAreaKgM3(areaTotal, T, input.density);

    assertFinite([H, dishArea, faceArea, areaTotal, blankDia, blankArea, weight]);

    const result = {
        kind: type,
        id: input.id,
        R,
        T,
        SF,
        H,
        CR,
        KR,
        thetaC,
        thetaK,
        dishArea,
        faceArea,
        areaTotal,
        meridian,
        blankDia,
        blankArea,
        weight,
        quantity: input.quantity,
        totalWeight: weight * input.quantity,
        density: input.density,
        materialName: input.materialName,
        divisions: null,
        stepDeg: null,
        stations: null
    };

    if (type === "template") {
        result.divisions = input.divisions;
        result.stepDeg = 360 / input.divisions;
        result.stations = buildStations(R, H, input.divisions, blankDia / 2);
    }

    return result;
}

module.exports = {
    TYPES,
    TYPE_FIELDS,
    readInput,
    compute,
    geometry: { torispherical, ellipsoidDishArea, meridianArc, buildStations }
};
