/*
 * Material data endpoints.
 *
 * /api/bootstrap.js hands the density tables to the browser as a synchronous
 * script, so the calculator pages can keep their existing startup order. The
 * JSON endpoints are there for tooling and tests.
 */
"use strict";

const { PUBLIC_API_BASE } = require("../config");
const {
    SECTION_MATERIALS,
    DISH_MATERIALS,
    DENSITY_REFERENCE
} = require("../materials/materialDensity");

function bootstrapScript() {
    const payload = [
        "/* Served by the backend — do not edit in the browser. */",
        "window.MW_API_BASE = " + JSON.stringify(PUBLIC_API_BASE) + ";",
        "window.MW_MATERIALS = " + JSON.stringify(SECTION_MATERIALS) + ";",
        "window.MW_DISH_MATERIALS = " + JSON.stringify(DISH_MATERIALS) + ";"
    ].join("\n");

    return payload + "\n";
}

function materialsJson() {
    return {
        ok: true,
        units: { sections: "g/cm3", dishEnds: "kg/m3" },
        sections: SECTION_MATERIALS,
        dishEnds: DISH_MATERIALS,
        reference: DENSITY_REFERENCE
    };
}

module.exports = { bootstrapScript, materialsJson };
