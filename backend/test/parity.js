/*
 * Parity test: every calculator is run twice with identical inputs.
 *
 *   original  test/fixtures/original — the calculator pages as they were
 *             before the restructure, formulas computed in the page
 *   migrated  frontend/calculators/<slug>/<slug>.js — the same page after the
 *             restructure, numbers from the backend
 *
 * Both runs render into the same DOM stub, and every rendered string, the
 * calculation history payload and the result object are compared.
 *
 * The fixtures are reference material for this test only: they live in the
 * backend folder, the frontend never loads them.
 *
 * Usage:  npm test                      (starts its own server)
 *         node test/parity.js [apiBaseUrl]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createContext, run } = require("./domStub");

const ROOT = path.resolve(__dirname, "..", "..");
const ORIG = path.join(__dirname, "fixtures", "original", "calculators");
const LIVE = path.join(ROOT, "frontend", "calculators");
let API_BASE = process.argv[2] || "http://127.0.0.1:8080";

const SEEDS = {
    "box-channel": { b: 40, h: 60, t: 4, length: 1000 },
    "c-channel": { h: 100, b: 50, tw: 6, tf: 8, length: 2000 },
    "e-section": { h: 100, b: 50, tw: 6, tf: 8, length: 2000 },
    "i-channel": { h: 120, b: 60, tw: 5, tf: 9, length: 1500 },
    "t-channel": { h: 90, b: 45, tw: 6, tf: 7, length: 1200 },
    "l-channel": { legA: 50, legB: 50, t: 5, length: 1000 },
    "pipe": { od: 100, wall: 5, length: 2000 },
    "shell": { od: 500, thickness: 6, length: 3000 },
    "plate": { width: 1000, thickness: 5, length: 2000 },
    "circular-plate": { diameter: 500, thickness: 10 },
    "round-bar": { diameter: 50, length: 1000 },
    "solid-cone": { diameter: 200, height: 300 },
    "sphere-ball": { diameter: 300 },
    "truncated-cone": { largeDiameter: 400, smallDiameter: 200, height: 300, thickness: 6 },
    "flange-plate": { od: 300, id: 150, thickness: 20, holes: 8, holeDiameter: 18, pcd: 240 },
    "hexagon-bar": { a: 30, length: 1000 },
    "hexagonal-bar-with-round-hole": { a: 40, d: 20, length: 1000 },
    "round-bar-with-hexagonal-hole": { diameter: 60, a: 25, length: 1000 },
    "square-bar": { a: 30, b: 50, length: 1000 },
    "trapezium-bar": { a: 50, b: 70, h: 40, length: 1000 },
    "trapezoidal-bar": { a: 50, b: 70, h: 40, length: 1000 },
    "triangular-bar": { b: 60, h: 50, length: 1000 }
};

const SCENARIOS = [
    { name: "carbon steel", material: "carbon-steel", quantity: 3 },
    { name: "aluminium x1", material: "aluminium", quantity: 1 },
    { name: "custom density 9.1", material: "custom", quantity: 7, customDensity: 9.1 }
];

function fail(message) {
    throw new Error(message);
}

function loadPage(context, file) {
    const code = fs.readFileSync(file, "utf8");
    run(context, code, file);
}

async function runPage(slug, file, scenario) {
    const context = createContext();
    const doc = context.document;

    if (file === undefined) {
        fail("missing file");
    }

    const calcApi = path.join(ROOT, "frontend", "assets", "js", "calc-api.js");

    if (fs.readFileSync(file, "utf8").indexOf("MWCalc.calculate") !== -1) {
        /* The migrated page loads the density tables from the backend. */
        const bootstrap = await fetch(API_BASE + "/api/bootstrap.js");
        run(context, await bootstrap.text(), "api/bootstrap.js");
        /* The live site uses the same origin; the test points at the server. */
        context.MW_API_BASE = API_BASE;
        loadPage(context, calcApi);
    }

    loadPage(context, file);

    for (const [id, value] of Object.entries(SEEDS[slug])) {
        doc.get(id).value = String(value);
    }

    doc.get("quantity").value = String(scenario.quantity);
    doc.get("material").value = scenario.material;

    if (scenario.customDensity !== undefined) {
        doc.get("customDensity").value = String(scenario.customDensity);
    }

    doc.fireReady();

    const calc = context.calculateWeight;

    if (typeof calc !== "function") {
        fail("calculateWeight missing in " + file);
    }

    await calc();

    const snapshot = {};
    const ids = Array.from(doc.nodes.keys()).sort();

    for (const id of ids) {
        const node = doc.nodes.get(id);
        snapshot[id] = {
            text: String(node.textContent),
            html: String(node.innerHTML),
            display: String(node.style.display)
        };
    }

    const history = context.window.CALCULATOR_HISTORY_CONFIG;
    const last = history && typeof history.getCalculation === "function"
        ? history.getCalculation()
        : null;

    return { snapshot: snapshot, last: last, error: doc.get("error").textContent };
}

function compare(slug, scenario, original, migrated) {
    const problems = [];
    const ids = new Set(Object.keys(original.snapshot).concat(Object.keys(migrated.snapshot)));

    for (const id of ids) {
        const a = original.snapshot[id] || { text: "", html: "", display: "" };
        const b = migrated.snapshot[id] || { text: "", html: "", display: "" };

        for (const key of ["text", "html", "display"]) {
            /* The migrated pages name the no-density state more clearly than
               the original pages. That label is display text, not a
               calculation result, so both wordings compare as equal. */
            const originalValue = id === "densityInfo" && key === "text" &&
                a[key] === "Unknown material"
                ? "Density is not configured for this material."
                : a[key];

            if (originalValue !== b[key]) {
                problems.push(
                    "#" + id + "." + key + "\n      original: " + JSON.stringify(a[key]) +
                    "\n      migrated: " + JSON.stringify(b[key])
                );
            }
        }
    }

    if ((original.last === null) !== (migrated.last === null)) {
        problems.push("history availability differs");
    } else if (original.last) {
        for (const key of Object.keys(original.last)) {
            if (key === "unit" || key === "materialName" || key === "density") {
                continue;
            }
            const a = original.last[key];
            const b = migrated.last[key];

            if (typeof a === "number" && typeof b === "number") {
                if (Math.abs(a - b) > Math.max(1e-9, Math.abs(a) * 1e-9)) {
                    problems.push("history." + key + ": " + a + " vs " + b);
                }
            } else if (JSON.stringify(a) !== JSON.stringify(b)) {
                problems.push("history." + key + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b));
            }
        }
    }

    if (migrated.error) {
        problems.push("migrated page shows error: " + migrated.error);
    }

    return problems;
}

/* ---------------------------------------------------------------- dish ends */

function runDishOriginal(cases) {
    const file = path.join(ORIG, "dish-ends", "dish-ends.js");
    const source = fs.readFileSync(file, "utf8");
    const start = source.indexOf("    function torispherical(R, CR, KR)");
    const end = source.indexOf("    /* ==================================================\n       VALIDATION", start);

    if (start === -1 || end === -1) {
        fail("cannot slice computeResult out of the original dish-ends.js");
    }

    const context = vm.createContext({
        Math: Math,
        Number: Number,
        Object: Object,
        Array: Array,
        JSON: JSON,
        isFinite: isFinite,
        state: { divisions: 8 },
        TYPE_INFO: {
            flat: { name: "Flat Head" },
            torispherical: { name: "Torispherical Head" },
            ellipsoidal: { name: "Ellipsoidal Head" },
            hemispherical: { name: "Hemispherical Head" },
            template: { name: "Template / Layout" }
        }
    });

    /* clamp() sits above the slice and is used by torispherical(). */
    const clampStart = source.indexOf("    function clamp(value, min, max) {");
    const clampEnd = source.indexOf("\n    }", clampStart) + "\n    }".length;

    vm.runInContext(source.slice(clampStart, clampEnd), context, { filename: file });
    vm.runInContext(source.slice(start, end), context, { filename: file });
    vm.runInContext("this.computeResult = computeResult;", context);

    return cases.map((input) => {
        /* The page keeps the selected head type in module state. */
        context.state.type = input.type;
        context.state.divisions = input.divisions;
        return context.computeResult(input);
    });
}

async function runDishMigrated(cases) {
    const dish = require("../calculations/dishEnds");

    return cases.map((input) => dish.compute(dish.readInput({
        type: input.type,
        values: { id: input.id, kr: input.kr, h: input.h, sf: input.sf, t: input.t },
        unit: "mm",
        density: input.density,
        quantity: input.quantity,
        divisions: input.divisions,
        materialName: input.materialName
    })));
}

function compareNumbers(label, a, b, problems) {
    if (typeof a === "number" && typeof b === "number") {
        if (!Number.isFinite(a) || !Number.isFinite(b)) {
            if (a !== b) {
                problems.push(label + ": " + a + " vs " + b);
            }
            return;
        }
        if (Math.abs(a - b) > Math.max(1e-9, Math.abs(a) * 1e-9)) {
            problems.push(label + ": " + a + " vs " + b);
        }
        return;
    }

    if (JSON.stringify(a) !== JSON.stringify(b)) {
        problems.push(label + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b));
    }
}

async function dishParity() {
    const cases = [
        { id: 1000, kr: 100, sf: 40, h: 0, t: 6, density: 7850, quantity: 1, divisions: 8, materialName: "Carbon Steel", type: "flat" },
        { id: 1000, kr: 100, sf: 40, h: 0, t: 8, density: 7850, quantity: 2, divisions: 8, materialName: "Carbon Steel", type: "torispherical" },
        { id: 1000, kr: 0, sf: 40, h: 250, t: 8, density: 7930, quantity: 1, divisions: 12, materialName: "SS 304", type: "ellipsoidal" },
        { id: 800, kr: 0, sf: 25, h: 0, t: 6, density: 2700, quantity: 4, divisions: 8, materialName: "Aluminium", type: "hemispherical" },
        { id: 1200, kr: 0, h: 300, sf: 30, t: 10, density: 7980, quantity: 1, divisions: 12, materialName: "SS 316", type: "template" }
    ];

    const original = runDishOriginal(cases);
    const migrated = await runDishMigrated(cases);
    const problems = [];

    cases.forEach((input, index) => {
        const a = original[index];
        const b = migrated[index];
        const keys = new Set(Object.keys(a).concat(Object.keys(b)));

        for (const key of keys) {
            if (key === "stations") {
                const as = a.stations || [];
                const bs = b.stations || [];

                if (as.length !== bs.length) {
                    problems.push(input.type + ".stations length " + as.length + " vs " + bs.length);
                    continue;
                }
                as.forEach((station, i) => {
                    for (const k of Object.keys(station)) {
                        compareNumbers(input.type + ".stations[" + i + "]." + k, station[k], bs[i][k], problems);
                    }
                });
                continue;
            }

            if (key === "name") {
                continue;  /* the head title is a page label, not a calculation */
            }

            compareNumbers(input.type + "." + key, a[key], b[key], problems);
        }
    });

    return problems;
}

/* ---------------------------------------------------------------------- main */

/* Reuse a running server, or start a throwaway one on a free port. */
async function ensureServer() {
    try {
        const response = await fetch(API_BASE + "/api/health");
        if (response.ok) {
            return null;
        }
    } catch (error) {
        /* not running yet */
    }

    const http = require("http");
    const { attach } = require("../app");
    const server = attach(http.createServer());

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    API_BASE = "http://127.0.0.1:" + server.address().port;

    return server;
}

async function main() {
    const ownServer = await ensureServer();
    const slugs = Object.keys(SEEDS).sort();
    let checks = 0;
    const failures = [];

    for (const slug of slugs) {
        const originalFile = path.join(ORIG, slug, slug + ".js");
        const migratedFile = path.join(LIVE, slug, slug + ".js");

        for (const scenario of SCENARIOS) {
            let original;
            let migrated;

            try {
                original = await runPage(slug, originalFile, scenario);
            } catch (error) {
                failures.push(slug + " [" + scenario.name + "] ORIGINAL: " + error.message);
                continue;
            }

            try {
                migrated = await runPage(slug, migratedFile, scenario);
            } catch (error) {
                failures.push(slug + " [" + scenario.name + "] MIGRATED: " + error.message);
                continue;
            }

            const problems = compare(slug, scenario, original, migrated);
            checks += 1;

            if (problems.length) {
                failures.push(slug + " [" + scenario.name + "]\n    " + problems.slice(0, 8).join("\n    "));
            }
        }
    }

    const dishProblems = await dishParity();
    checks += 5;

    for (const problem of dishProblems.slice(0, 20)) {
        failures.push("dish-ends: " + problem);
    }

    if (ownServer) {
        ownServer.close();
    }

    console.log("api under test: " + API_BASE);
    console.log("calculator/scenario pairs compared: " + checks);

    if (failures.length) {
        console.log("\nFAILURES (" + failures.length + "):");
        failures.forEach((line) => console.log("  - " + line));
        process.exit(1);
    }

    console.log("PASS — every calculator matches the original implementation.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
