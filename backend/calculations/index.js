/*
 * Calculator registry.
 *
 * The API is addressed by the same folder name the website uses
 * (/calculators/<slug>/), so the two sides cannot drift apart.
 */
"use strict";

const prismatic = require("./prismatic");
const circularPlate = require("./circularPlate");
const roundBar = require("./roundBar");
const solidCone = require("./solidCone");
const sphereBall = require("./sphereBall");
const truncatedCone = require("./truncatedCone");
const flangePlate = require("./flangePlate");
const dishEnds = require("./dishEnds");
const nutBolt = require("./nutBolt");

const modules = {
    "circular-plate": circularPlate,
    "round-bar": roundBar,
    "solid-cone": solidCone,
    "sphere-ball": sphereBall,
    "truncated-cone": truncatedCone,
    "flange-plate": flangePlate,
    "dish-ends": { compute: (payload) => dishEnds.compute(dishEnds.readInput(payload)) },
    "nut-bolt": nutBolt
};

for (const slug of prismatic.slugs) {
    modules[slug] = {
        compute: (payload) => prismatic.compute(slug, payload)
    };
}

const registry = Object.freeze(modules);

function get(slug) {
    return Object.prototype.hasOwnProperty.call(registry, slug)
        ? registry[slug]
        : null;
}

function list() {
    return Object.keys(registry).sort();
}

module.exports = { registry, get, list };
