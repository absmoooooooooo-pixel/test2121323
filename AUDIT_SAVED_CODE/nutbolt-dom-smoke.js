/* Lightweight DOM smoke test for the Nut & Bolt drawing renderer.
   Run with: node AUDIT_SAVED_CODE/nutbolt-dom-smoke.js */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const sourcePath = path.join(__dirname, "..", "frontend", "calculators", "nut-bolt", "nut-bolt.js");
const source = fs.readFileSync(sourcePath, "utf8");

const elements = new Map();
const fieldInputs = new Map();
const categoryTabs = ["bolts", "studs", "nuts"].map(function (category) {
    return makeElement("tab-" + category, { dataset: { category: category } });
});

function makeElement(id, extra) {
    const element = {
        id: id,
        value: "",
        textContent: "",
        innerHTML: "",
        className: "",
        tabIndex: 0,
        hidden: false,
        dataset: {},
        attributes: {},
        listeners: {},
        children: [],
        classList: {
            add: function () {},
            remove: function () {},
            toggle: function () {},
            contains: function () { return false; }
        },
        setAttribute: function (name, value) { element.attributes[name] = String(value); },
        getAttribute: function (name) {
            return Object.prototype.hasOwnProperty.call(element.attributes, name)
                ? element.attributes[name] : null;
        },
        removeAttribute: function (name) { delete element.attributes[name]; },
        addEventListener: function (type, handler) {
            (element.listeners[type] = element.listeners[type] || []).push(handler);
        },
        dispatch: function (type, event) {
            (element.listeners[type] || []).forEach(function (handler) {
                handler.call(element, event || { target: element, isTrusted: false });
            });
        },
        querySelector: function () { return null; },
        querySelectorAll: function (selector) {
            if (selector === "[data-dim]") {
                const matches = [];
                const re = /data-dim="([^"]+)"[^>]*>([^<]*)</g;
                let match;

                while ((match = re.exec(element.innerHTML)) !== null) {
                    matches.push({
                        textContent: match[2],
                        getAttribute: function (name) {
                            return name === "data-dim" ? match[1] : null;
                        }
                    });
                }

                return matches;
            }

            return [];
        },
        closest: function () { return element; },
        focus: function () {}
    };

    Object.keys(extra || {}).forEach(function (key) { element[key] = extra[key]; });
    return element;
}

function byId(id) {
    if (id.indexOf("field-") === 0) {
        if (!fieldInputs.has(id)) {
            fieldInputs.set(id, makeElement(id));
        }
        return fieldInputs.get(id);
    }

    if (!elements.has(id)) {
        elements.set(id, makeElement(id));
    }
    return elements.get(id);
}

const documentStub = {
    getElementById: byId,
    querySelectorAll: function (selector) {
        if (selector === ".category-tab") {
            return categoryTabs;
        }
        if (selector === "[data-field]") {
            return Array.from(fieldInputs.values());
        }
        return [];
    },
    createElement: function (tag) { return makeElement("created-" + tag); }
};

const windowStub = {
    MW_MATERIALS: {
        "carbon-steel": { name: "Carbon Steel", density: 7.85 },
        "stainless-steel": { name: "Stainless Steel", density: 8.00 }
    }
};

const context = vm.createContext({
    document: documentStub,
    window: windowStub,
    console: console
});

vm.runInContext(source, context, { filename: sourcePath });

const productSelect = byId("productSelect");
const diagramViews = byId("fastenerDiagramViews");
const products = [
    "hex-ft", "hex-ht", "hex-blank", "socket-head", "countersunk", "carriage",
    "stud-ft", "stud-de", "threaded-rod", "hex-nut", "heavy-hex-nut",
    "jam-nut", "square-nut", "lock-nut"
];

let failures = 0;

function inspect(label) {
    const html = diagramViews.innerHTML;
    const svgCount = (html.match(/<svg /g) || []).length;
    const dimCount = (html.match(/data-dim=/g) || []).length;
    const problems = [];

    if (svgCount < 1) { problems.push("no svg"); }
    if (dimCount < 1) { problems.push("no dimensions"); }
    if (/NaN|undefined|Infinity/.test(html)) { problems.push("invalid number in svg"); }
    if (!/viewBox="0 0 [\d.]+ [\d.]+"/.test(html)) { problems.push("no viewBox"); }
    if (!/fastener-drawing/.test(html)) { problems.push("missing drawing class"); }

    const svgRe = /<svg[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*>([\s\S]*?)<\/svg>/g;
    let svgMatch;
    let viewNumber = 0;

    while ((svgMatch = svgRe.exec(html)) !== null) {
        viewNumber += 1;
        const width = Number(svgMatch[1]);
        const height = Number(svgMatch[2]);
        const content = svgMatch[3];
        const coordRe = /\b(?:x|y|x1|y1|x2|y2|cx|cy)="(-?[\d.]+)"/g;
        let coordMatch;

        while ((coordMatch = coordRe.exec(content)) !== null) {
            const value = Number(coordMatch[1]);
            if (value < -2 || value > Math.max(width, height) + 2) {
                problems.push("view " + viewNumber + " coord " + value + " outside " +
                    width + "x" + height);
                break;
            }
        }
    }

    if (problems.length) {
        failures += 1;
        console.log("FAIL " + label + ": " + problems.slice(0, 5).join(", "));
    } else {
        console.log("PASS " + label + " — " + svgCount + " views, " + dimCount +
            " callouts, coordinates in bounds");
    }
}

const DRAWING_CSS = `
:root { color-scheme: light; }
body { margin: 0; background: #ffffff; }
svg { display: block; margin: 0 auto 18px; max-width: 100%; height: auto; }
.fastener-drawing {
  --ink: #000000; --face: #ffffff; --dim-ink: #000000;
  --centre-ink: #000000; --label-ink: #000000;
  font-family: Arial, Helvetica, sans-serif; background: #ffffff;
}
.fastener-part { fill: var(--face); stroke: var(--ink); stroke-width: 1.5;
  stroke-linejoin: miter; stroke-linecap: butt; vector-effect: non-scaling-stroke; }
.fastener-thread-line { fill: none; stroke: var(--ink); stroke-width: 1;
  stroke-linejoin: miter; vector-effect: non-scaling-stroke; }
.fastener-hidden { fill: none; stroke: #000000; stroke-width: 0.9;
  stroke-dasharray: 4 3; opacity: 1; vector-effect: non-scaling-stroke; }
.fastener-centre { fill: none; stroke: #000000; stroke-width: 0.9;
  stroke-dasharray: 12 3 2 3; opacity: 0.85; vector-effect: non-scaling-stroke; }
.fastener-dim { fill: none; stroke: var(--dim-ink); stroke-width: 1.05;
  vector-effect: non-scaling-stroke; }
.fastener-ext { fill: none; stroke: var(--dim-ink); stroke-width: 0.75;
  opacity: 1; vector-effect: non-scaling-stroke; }
.fastener-arrow { fill: none; stroke: var(--dim-ink); stroke-width: 1.15;
  stroke-linecap: round; stroke-linejoin: round; }
.fastener-point { fill: var(--dim-ink); stroke: none; }
.fastener-label { fill: var(--dim-ink); font-size: 16px; font-weight: 700;
  letter-spacing: 0.2px; paint-order: stroke; stroke: #ffffff;
  stroke-width: 4px; stroke-linejoin: round; }
@media (max-width: 520px) { .fastener-label { font-size: 20px; } }
@media (max-width: 420px) { .fastener-label { font-size: 22px; } }
`;

function dumpSvg(key, file) {
    const html = diagramViews.innerHTML;
    const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) || [];

    if (svgs.length) {
        fs.writeFileSync(path.join(__dirname, file),
            '<!doctype html><meta charset="utf-8"><style>' + DRAWING_CSS +
            '</style>' + svgs.join(""), "utf8");
    }
}

products.forEach(function (key) {
    const tab = categoryTabs.find(function (item) {
        const isStud = key === "stud-ft" || key === "stud-de" || key === "threaded-rod";
        const isNut = key.indexOf("nut") !== -1;
        return item.dataset.category === (isStud ? "studs" : isNut ? "nuts" : "bolts");
    });

    tab.dispatch("click");
    productSelect.value = key;
    productSelect.dispatch("change");
    inspect(key);

    if (key === "hex-ft") { dumpSvg(key, "drawing-hex-bolt.html"); }
    if (key === "hex-nut") { dumpSvg(key, "drawing-hex-nut.html"); }
    if (key === "stud-ft") { dumpSvg(key, "drawing-stud.html"); }
    if (key === "countersunk") { dumpSvg(key, "drawing-countersunk.html"); }
});

/* Rebuild a bolt and check that unit switching and manual pitch edits redraw. */
categoryTabs[0].dispatch("click");
productSelect.value = "hex-ft";
productSelect.dispatch("change");
byId("inchBtn").dispatch("click");
inspect("hex-ft after inch switch");
const mmLabels = diagramViews.innerHTML.match(/<text[^>]*>([^<]*)<\/text>/g) || [];
const mmLabelsOk = mmLabels.length === 5 &&
    mmLabels.every(function (label) { return / mm<\/text>$/.test(label); }) &&
    !/TPI/.test(diagramViews.innerHTML);

if (!mmLabelsOk) {
    failures += 1;
    console.log("FAIL hex-ft drawing must stay in mm: " + JSON.stringify(mmLabels));
} else {
    console.log("PASS hex-ft drawing stays in mm when display unit is inches");
}

productSelect.value = "hex-ht";
productSelect.dispatch("change");
const inchLabels = diagramViews.innerHTML.match(/<text[^>]*>([^<]*)<\/text>/g) || [];

if (!inchLabels.some(function (label) { return /TPI/.test(label); })) {
    failures += 1;
    console.log("FAIL inch callouts: no TPI text on hex-ht");
} else {
    console.log("PASS other products still show in/TPI callouts");
}

productSelect.value = "hex-ft";
productSelect.dispatch("change");
byId("mmBtn").dispatch("click");
const pitch = byId("field-pitch");
pitch.value = "2.5";
byId("dimensionFields").dispatch("input", { target: pitch, isTrusted: false });
inspect("hex-ft after manual pitch");
if (diagramViews.innerHTML.indexOf("P = 2.50 mm") === -1) {
    failures += 1;
    const labels = diagramViews.innerHTML.match(/P = [^<]+/g) || [];
    console.log("FAIL manual pitch: drawing did not update; labels=" + JSON.stringify(labels));
} else {
    console.log("PASS manual pitch updates drawing");
}

console.log("failures=" + failures);
process.exit(failures ? 1 : 0);
