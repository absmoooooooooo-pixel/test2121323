/*
 * Material density data — the single source of truth for the whole site.
 *
 * Two tables are kept because the calculators have always used two unit
 * systems. Do not convert one into the other: the values below are the exact
 * numbers the site published before the frontend/backend split.
 *
 *   SECTION_MATERIALS  — g/cm³  (plate, bar, pipe, channel, shell, flange ...)
 *   DISH_MATERIALS     — kg/m³  (dish ends calculator)
 *
 * They are served to the browser through GET /api/bootstrap.js, so the
 * frontend never ships its own copy of the density data.
 */
"use strict";

/* Density in g/cm³ — used by every calculator except dish ends. */
const SECTION_MATERIALS = Object.freeze({
    "carbon-steel": Object.freeze({ name: "Carbon Steel", density: 7.85 }),
    "stainless-steel": Object.freeze({ name: "Stainless Steel", density: 8.00 }),
    "aluminium": Object.freeze({ name: "Aluminium", density: 2.70 }),
    "brass": Object.freeze({ name: "Brass", density: 8.45 }),
    "bronze": Object.freeze({ name: "Bronze", density: 8.73 }),
    "cast-iron": Object.freeze({ name: "Cast Iron", density: 7.20 }),
    "copper": Object.freeze({ name: "Copper", density: 8.96 })
});

/* Density in kg/m³ — dish ends calculator. */
const DISH_MATERIALS = Object.freeze({
    "carbon-steel": Object.freeze({ name: "Carbon Steel", density: 7850 }),
    "ss-304": Object.freeze({ name: "Stainless Steel 304", density: 7930 }),
    "ss-316": Object.freeze({ name: "Stainless Steel 316", density: 7980 }),
    "ss-316l": Object.freeze({ name: "Stainless Steel 316L", density: 8000 }),
    "aluminium": Object.freeze({ name: "Aluminium", density: 2700 }),
    "custom": Object.freeze({ name: "Custom Material", density: null })
});

/* Density values shown in the reference tables on the pages (g/cm³). */
const DENSITY_REFERENCE = Object.freeze([
    Object.freeze({ material: "Carbon Steel", density: 7.85 }),
    Object.freeze({ material: "Stainless Steel", density: 8.00 }),
    Object.freeze({ material: "Aluminium", density: 2.70 }),
    Object.freeze({ material: "Brass", density: 8.45 }),
    Object.freeze({ material: "Bronze", density: 8.73 }),
    Object.freeze({ material: "Cast Iron", density: 7.20 }),
    Object.freeze({ material: "Copper", density: 8.96 }),
    Object.freeze({ material: "Mild Steel", density: 7.85 }),
    Object.freeze({ material: "Stainless Steel 304", density: 7.93 }),
    Object.freeze({ material: "Stainless Steel 316", density: 7.98 }),
    Object.freeze({ material: "Stainless Steel 316L", density: 8.00 }),
    Object.freeze({ material: "Duplex Steel", density: 7.80 }),
    Object.freeze({ material: "Inconel", density: 8.19 }),
    Object.freeze({ material: "Monel", density: 8.80 }),
    Object.freeze({ material: "Titanium", density: 4.51 })
]);

function lookup(table, key) {
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
}

module.exports = {
    SECTION_MATERIALS,
    DISH_MATERIALS,
    DENSITY_REFERENCE,
    lookup
};
