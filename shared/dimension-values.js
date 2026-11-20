/* ==================================================
   DIAGRAM DIMENSION VALUES JAVASCRIPT START
   Writes typed values next to the labels inside the SVG drawings.
   Here is the logic for showing the value inside the diagram labels.
================================================== */
/*
 * Dynamic dimension values for calculator drawings.
 *
 * Shows the entered value with its dimension label ("W" -> "W = 21"), keeping
 * the complete annotation inside the drawing, clear of dimension lines,
 * arrows and geometry, and restores the plain label when the input is cleared.
 *
 * Widths are measured in the browser, so every drawing places the annotation
 * according to its own space instead of shared coordinates.
 *
 * Usage (after the page markup and the calculator script):
 *
 *   initDimensionValues([
 *       { input: "diameter", label: "dimD" },
 *       { input: "length", label: "dimL" }
 *   ]);
 */

(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var PAD = 3;
    var PERP_STEPS = [0, -6, 6, -12, 12, -18, 18, -24, 24, -30, 30, -36, 36];
    var registry = [];
    var pendingFrame = false;
    var generation = 0;

// ==================================================
// FUNCTION: ROUND START
// This function performs the round step of this calculator.
// This is where this function's work happens.
// ==================================================
    function round(value) {
        return (Math.round(value * 100) / 100).toString();
    }
// ==================================================
// FUNCTION: ROUND END
// This function ends here.
// ==================================================

    /* Only a finite, positive number counts as an entered value. */
// ==================================================
// FUNCTION: READ VALUE START
// This function performs the read value step of this calculator.
// This is where this function's work happens.
// ==================================================
    function readValue(input) {
        var raw = (input.value || "").trim();
        var value = Number(raw);

        if (raw === "" || !isFinite(value) || value <= 0) {
            return "";
        }

        return raw;
    }
// ==================================================
// FUNCTION: READ VALUE END
// This function ends here.
// ==================================================

    /* Matrix that maps the element's own coordinates into the drawing. */
// ==================================================
// FUNCTION: MATRIX OF START
// This function performs the matrix of step of this calculator.
// This is where this function's work happens.
// ==================================================
    function matrixOf(el) {
        var svg = el.ownerSVGElement;
        var matrix;
        var root;

        if (!svg) {
            return null;
        }

        try {
            matrix = el.getScreenCTM();
            root = svg.getScreenCTM();
        } catch (error) {
            return null;
        }

        if (!matrix || !root) {
            return null;
        }

        try {
            return root.inverse().multiply(matrix);
        } catch (error) {
            return null;
        }
    }
// ==================================================
// FUNCTION: MATRIX OF END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: POINT START
// This function performs the point step of this calculator.
// This is where this function's work happens.
// ==================================================
    function point(matrix, x, y) {
        return {
            x: matrix.a * x + matrix.c * y + matrix.e,
            y: matrix.b * x + matrix.d * y + matrix.f
        };
    }
// ==================================================
// FUNCTION: POINT END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: VIEWPORT START
// This function performs the viewport step of this calculator.
// This is where this function's work happens.
// ==================================================
    function viewport(svg) {
        var box = svg.viewBox && svg.viewBox.baseVal;

        if (box && box.width && box.height) {
            return { width: box.width, height: box.height };
        }

        return { width: 300, height: 200 };
    }
// ==================================================
// FUNCTION: VIEWPORT END
// This function ends here.
// ==================================================

    /* Rectangle of a local text box once the label transform is applied. */
// ==================================================
// FUNCTION: ROOT BOX START
// This function performs the root box step of this calculator.
// This is where this function's work happens.
// ==================================================
    function rootBox(matrix, left, top, width, height) {
        var corners = [
            [left, top],
            [left + width, top],
            [left, top + height],
            [left + width, top + height]
        ];
        var box = {
            left: Infinity,
            top: Infinity,
            right: -Infinity,
            bottom: -Infinity
        };

        corners.forEach(function (corner) {
            var mapped = point(matrix, corner[0], corner[1]);

            box.left = Math.min(box.left, mapped.x);
            box.top = Math.min(box.top, mapped.y);
            box.right = Math.max(box.right, mapped.x);
            box.bottom = Math.max(box.bottom, mapped.y);
        });

        return box;
    }
// ==================================================
// FUNCTION: ROOT BOX END
// This function ends here.
// ==================================================

    /* Drawing lines around the text, sampled once per drawing per pass. */
// ==================================================
// FUNCTION: DRAWING POINTS START
// This function performs the drawing points step of this calculator.
// This is where this function's work happens.
// ==================================================
    function drawingPoints(svg) {
        if (svg.__dimPointsGen === generation) {
            return svg.__dimPoints;
        }

        var points = [];
        var nodes = svg.querySelectorAll("path, line, polyline");

        Array.prototype.forEach.call(nodes, function (node) {
            if (node.hasAttribute("data-dim-gap") ||
                node.closest("defs") ||
                node.closest("clipPath") ||
                node.closest("marker")) {
                return;
            }

            if (node.getAttribute("fill") !== null &&
                node.getAttribute("fill") !== "none" &&
                node.getAttribute("stroke") === null) {
                return;
            }

            var length = 0;

            try {
                length = node.getTotalLength();
            } catch (error) {
                return;
            }

            if (!length) {
                return;
            }

            var matrix = matrixOf(node);

            if (!matrix) {
                return;
            }

            var step = Math.max(1, length / 160);

            for (var travelled = 0; travelled <= length; travelled += step) {
                var local = node.getPointAtLength(travelled);
                var mapped = point(matrix, local.x, local.y);

                points.push(mapped.x, mapped.y);
            }
        });

        svg.__dimPoints = points;
        svg.__dimPointsGen = generation;

        return points;
    }
// ==================================================
// FUNCTION: DRAWING POINTS END
// This function ends here.
// ==================================================

    /* Number of sampled line points inside the box. */
// ==================================================
// FUNCTION: CROSSINGS START
// This function performs the crossings step of this calculator.
// This is where this function's work happens.
// ==================================================
    function crossings(points, box) {
        var count = 0;
        var left = box.left + 0.7;
        var top = box.top + 0.7;
        var right = box.right - 0.7;
        var bottom = box.bottom - 0.7;

        for (var index = 0; index < points.length; index += 2) {
            var x = points[index];
            var y = points[index + 1];

            if (x > left && x < right && y > top && y < bottom) {
                count++;
            }
        }

        return count;
    }
// ==================================================
// FUNCTION: CROSSINGS END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: OVERFLOW START
// This function performs the overflow step of this calculator.
// This is where this function's work happens.
// ==================================================
    function overflow(box, size) {
        var amount = 0;

        if (box.left < PAD) {
            amount += PAD - box.left;
        }

        if (box.top < PAD) {
            amount += PAD - box.top;
        }

        if (box.right > size.width - PAD) {
            amount += box.right - (size.width - PAD);
        }

        if (box.bottom > size.height - PAD) {
            amount += box.bottom - (size.height - PAD);
        }

        return amount;
    }
// ==================================================
// FUNCTION: OVERFLOW END
// This function ends here.
// ==================================================

    /* Slide a candidate along its own text direction until it fits. */
// ==================================================
// FUNCTION: SLIDE INSIDE START
// This function performs the slide inside step of this calculator.
// This is where this function's work happens.
// ==================================================
    function slideInside(box, left, direction, size) {
        var offsetX = 0;
        var offsetY = 0;

        if (box.left < PAD) {
            offsetX = PAD - box.left;
        } else if (box.right > size.width - PAD) {
            offsetX = size.width - PAD - box.right;
        }

        if (box.top < PAD) {
            offsetY = PAD - box.top;
        } else if (box.bottom > size.height - PAD) {
            offsetY = size.height - PAD - box.bottom;
        }

        if (!offsetX && !offsetY) {
            return left;
        }

        return left + offsetX * direction.x + offsetY * direction.y;
    }
// ==================================================
// FUNCTION: SLIDE INSIDE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: MEASURE START
// This function performs the measure step of this calculator.
// This is where this function's work happens.
// ==================================================
    function measure(label, text) {
        label.textContent = text;

        try {
            return label.getBBox();
        } catch (error) {
            return null;
        }
    }
// ==================================================
// FUNCTION: MEASURE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: RESTORE START
// This function performs the restore step of this calculator.
// This is where this function's work happens.
// ==================================================
    function restore(label, state) {
        label.textContent = state.text;
        label.setAttribute("x", round(state.x));
        label.setAttribute("y", round(state.y));
        label.setAttribute("text-anchor", state.anchor);

        if (isStable(label)) {
            label.removeAttribute("paint-order");
            label.removeAttribute("stroke");
            label.removeAttribute("stroke-width");
            label.removeAttribute("stroke-linejoin");
        }
    }
// ==================================================
// FUNCTION: RESTORE END
// This function ends here.
// ==================================================

    /* Labels marked "data-dim-stable" keep the anchor they were drawn at:
       the value only changes the text, never the position. */
// ==================================================
// FUNCTION: IS STABLE START
// This function performs the is stable step of this calculator.
// This is where this function's work happens.
// ==================================================
    function isStable(label) {
        return label.hasAttribute("data-dim-stable");
    }
// ==================================================
// FUNCTION: IS STABLE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: PLACE STABLE START
// This function performs the place stable step of this calculator.
// This is where this function's work happens.
// ==================================================
    function placeStable(label, entry, text, state) {
        label.textContent = text;
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("x", round(state.x));
        label.setAttribute("y", round(state.y));

        /* A long value can reach a thin extension line; a white halo behind
           the letters lifts the text off the line without moving it. */
        label.setAttribute("paint-order", "stroke");
        label.setAttribute("stroke", "#ffffff");
        label.setAttribute("stroke-width", "3.2");
        label.setAttribute("stroke-linejoin", "round");

        entry.applied = {
            text: text,
            anchor: "middle"
        };

        dropMask(label);
    }
// ==================================================
// FUNCTION: PLACE STABLE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: DROP MASK START
// This function performs the drop mask step of this calculator.
// This is where this function's work happens.
// ==================================================
    function dropMask(label) {
        var masks = label.__dimMasks || [];

        masks.forEach(function (mask) {
            if (mask.parentNode) {
                mask.parentNode.removeChild(mask);
            }
        });

        label.__dimMasks = [];
    }
// ==================================================
// FUNCTION: DROP MASK END
// This function ends here.
// ==================================================

    /* White gap behind the complete text where a line still passes it. */
// ==================================================
// FUNCTION: APPLY MASK START
// This function performs the apply mask step of this calculator.
// This is where this function's work happens.
// ==================================================
    function applyMask(label, box) {
        dropMask(label);

        if (!box || !label.id || label.parentNode !== label.ownerSVGElement) {
            return;
        }

        var svg = label.ownerSVGElement;
        var points = drawingPoints(svg);

        if (!crossings(points, box)) {
            return;
        }

        var gap = document.createElementNS(SVG_NS, "rect");

        gap.setAttribute("data-dim-gap", label.id);
        gap.setAttribute("fill", "#ffffff");
        gap.setAttribute("x", round(box.left - 1.5));
        gap.setAttribute("y", round(box.top - 1.5));
        gap.setAttribute("width", round(box.right - box.left + 3));
        gap.setAttribute("height", round(box.bottom - box.top + 3));
        gap.setAttribute("aria-hidden", "true");

        label.parentNode.insertBefore(gap, label);
        label.__dimMasks = [gap];
    }
// ==================================================
// FUNCTION: APPLY MASK END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: STATE OF START
// This function performs the state of step of this calculator.
// This is where this function's work happens.
// ==================================================
    function stateOf(label, entry) {
        if (entry.state) {
            return entry.state;
        }

        entry.state = {
            text: label.textContent.trim(),
            x: parseFloat(label.getAttribute("x")) || 0,
            y: parseFloat(label.getAttribute("y")) || 0,
            anchor: label.getAttribute("text-anchor") || "start",
            rotated: /rotate/.test(label.getAttribute("transform") || "")
        };

        return entry.state;
    }
// ==================================================
// FUNCTION: STATE OF END
// This function ends here.
// ==================================================

    /* The drawing may move its own labels while typing; keep following it. */
// ==================================================
// FUNCTION: REFRESH STATE START
// This function performs the refresh state step of this calculator.
// This is where this function's work happens.
// ==================================================
    function refreshState(label, entry) {
        var applied = entry.applied;

        if (!applied) {
            return;
        }

        if (label.textContent.trim() === applied.text) {
            return;
        }

        var state = entry.state;
        var text = label.textContent.trim();

        /* A stable label owns its position; only its text may change. */
        if (isStable(label)) {
            if (text) {
                state.text = text;
            }

            return;
        }

        state.x = parseFloat(label.getAttribute("x")) || 0;
        state.y = parseFloat(label.getAttribute("y")) || 0;
        state.anchor = label.getAttribute("text-anchor") || "start";

        if (text && text !== applied.text) {
            state.text = text;
        }
    }
// ==================================================
// FUNCTION: REFRESH STATE END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SYNC ENTRY START
// This function performs the sync entry step of this calculator.
// This is where this function's work happens.
// ==================================================
    function syncEntry(entry) {
        var input = document.getElementById(entry.input);
        var label = document.getElementById(entry.label);

        if (!input || !label) {
            return;
        }

        var state = stateOf(label, entry);

        refreshState(label, entry);

        var value = readValue(input);

        if (!value) {
            restore(label, state);
            dropMask(label);
            entry.applied = null;
            return;
        }

        var svg = label.ownerSVGElement;
        var matrix = svg ? matrixOf(label) : null;

        if (!svg || !matrix) {
            return;
        }

        restore(label, state);

        if (isStable(label)) {
            placeStable(label, entry, state.text + " = " + value, state);
            return;
        }

        var base = measure(label, state.text);

        if (!base || !base.width) {
            restore(label, state);
            return;
        }

        var text = state.text + " = " + value;

        label.setAttribute("text-anchor", "middle");
        label.setAttribute("x", 0);

        var combined = measure(label, text);

        if (!combined || !combined.width) {
            restore(label, state);
            return;
        }

        var size = viewport(svg);
        var direction = point(matrix, 1, 0);
        var origin = point(matrix, 0, 0);

        direction = {
            x: direction.x - origin.x,
            y: direction.y - origin.y
        };

        var length = Math.hypot(direction.x, direction.y) || 1;

        direction = { x: direction.x / length, y: direction.y / length };

        var centre = base.x + base.width / 2;
        var ink = combined.x + combined.width / 2;
        var starts = {
            start: base.x - combined.x,
            middle: centre - ink,
            end: base.x + base.width - (combined.x + combined.width)
        };
        var order = state.anchor === "middle"
            ? ["middle", "start", "end"]
            : (state.anchor === "end" ? ["end", "middle", "start"]
                : ["start", "middle", "end"]);

        /* Rotated labels may step away from their line to find room;
           horizontal labels only nudge a little as a last resort. */
        var perps = state.rotated ? PERP_STEPS : [0, -5, 5, -10, 10];

        var best = null;

        outer:
        for (var index = 0; index < order.length; index++) {
            var baseX = starts[order[index]];

            for (var step = 0; step < perps.length; step++) {
                var perp = perps[step];
                var left = baseX + combined.x;
                var box = rootBox(matrix, left, combined.y + perp,
                    combined.width, combined.height);

                var slid = slideInside(box, left, direction, size);
                var placed = baseX + (slid - left);

                left = slid;

                box = rootBox(matrix, left, combined.y + perp,
                    combined.width, combined.height);

                var hits = crossings(drawingPoints(svg), box);
                var score = (hits ? 400 + Math.min(hits, 20) : 0) +
                    overflow(box, size) * 40 +
                    Math.abs(perp) * 0.7 +
                    index * 0.4 +
                    step * 0.05;

                if (!best || score < best.score) {
                    best = {
                        x: placed,
                        perp: perp,
                        box: box,
                        score: score
                    };
                }

                if (score < 0.5) {
                    break outer;
                }
            }
        }

        if (!best) {
            restore(label, state);
            return;
        }

        label.textContent = text;
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("x", round(best.x));
        label.setAttribute("y", round(state.y + best.perp));

        entry.applied = {
            text: text,
            anchor: "middle"
        };

        applyMask(label, best.box);
    }
// ==================================================
// FUNCTION: SYNC ENTRY END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: SYNC ALL START
// This function performs the sync all step of this calculator.
// This is where this function's work happens.
// ==================================================
    function syncAll() {
        generation += 1;
        registry.forEach(syncEntry);

        if (pendingFrame) {
            return;
        }

        pendingFrame = true;

        /* Some drawings reposition their labels while typing, so place the
           values once more after the browser has laid the labels out. */
        window.requestAnimationFrame(function () {
            pendingFrame = false;
            generation += 1;
            registry.forEach(syncEntry);
        });
    }
// ==================================================
// FUNCTION: SYNC ALL END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: INIT DIMENSION VALUES START
// This function performs the init dimension values step of this calculator.
// This is where this function's work happens.
// ==================================================
    function initDimensionValues(list) {
        (list || []).forEach(function (item) {
            var input = document.getElementById(item.input);
            var label = document.getElementById(item.label);

            if (!input || !label) {
                return;
            }

            var known = registry.some(function (entry) {
                return entry.input === item.input && entry.label === item.label;
            });

            if (known) {
                return;
            }

            registry.push({
                input: item.input,
                label: item.label
            });

            input.addEventListener("input", syncAll);
            input.addEventListener("change", syncAll);
        });

        syncAll();
    }
// ==================================================
// FUNCTION: INIT DIMENSION VALUES END
// This function ends here.
// ==================================================

// ==================================================
// FUNCTION: INIT START
// This function performs the init step of this calculator.
// This is where this function's work happens.
// ==================================================
    function init() {
        initDimensionValues(window.CALCULATOR_DIMENSION_VALUES);
    }
// ==================================================
// FUNCTION: INIT END
// This function ends here.
// ==================================================

    document.addEventListener("click", function (event) {
        var target = event.target;

        if (!target || !target.closest) {
            return;
        }

        if (target.closest("#resetBtn, [data-reset]")) {
            window.setTimeout(syncAll, 0);
        }
    });

    window.addEventListener("pageshow", syncAll);

    window.initDimensionValues = initDimensionValues;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

/* ==================================================
   DIAGRAM DIMENSION VALUES JAVASCRIPT END
   This JavaScript file ends here.
================================================== */