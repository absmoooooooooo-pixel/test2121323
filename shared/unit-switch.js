/* ==================================================
   MM / INCHES UNIT CONVERSION START
   Shared conversion used by the dimension calculators.
   Switching units keeps the same physical size on screen.
================================================== */
(function () {
    "use strict";

    var INCH_IN_MM = 25.4;
    var states = typeof WeakMap === "function" ? new WeakMap() : null;

    function stateFor(input) {
        var state = states ? states.get(input) : input.__mwUnitState;

        if (state) {
            return state;
        }

        state = { mm: null, clean: false };

        if (states) {
            states.set(input, state);
        } else {
            input.__mwUnitState = state;
        }

        /* A real edit invalidates the remembered millimetre value. Events
           dispatched by page scripts are ignored, so a programmatic redraw
           cannot make a converted value look user-edited. */
        input.addEventListener("input", function (event) {
            if (event.isTrusted) {
                state.mm = null;
                state.clean = false;
            }
        });

        return state;
    }

    /* Enough precision for inch values while keeping the field readable. */
    function format(value) {
        return String(Math.round(value * 1e6) / 1e6);
    }

    function activeFields() {
        var config = window.CALCULATOR_HISTORY_CONFIG;

        if (!config || !config.dimensions) {
            return [];
        }

        return config.dimensions.filter(function (item) {
            return item && item.unit !== false;
        });
    }

    /* Converts every dimension input from one unit to the other.
       The exact millimetre value is remembered between switches, so
       1000 mm -> inches -> mm returns 1000 instead of a rounded value. */
    function convert(fromUnit, toUnit) {
        if (fromUnit === toUnit) {
            return;
        }

        var changed = [];

        activeFields().forEach(function (item) {
            var input = document.getElementById(item.key);

            if (!input) {
                return;
            }

            var state = stateFor(input);
            var raw = (input.value || "").trim();

            if (raw === "") {
                state.mm = null;
                state.clean = true;
                return;
            }

            var value = Number(raw);

            if (!isFinite(value)) {
                return;
            }

            var mm = state.clean && state.mm !== null
                ? state.mm
                : (fromUnit === "in" ? value * INCH_IN_MM : value);

            state.mm = mm;
            state.clean = true;

            input.value = format(toUnit === "in" ? mm / INCH_IN_MM : mm);
            changed.push(input);
        });

        /* Let the drawings and dimension labels refresh without pretending
           the user typed: page scripts listen for change, while the exact
           millimetre memory above only reacts to real input events. */
        changed.forEach(function (input) {
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    window.MWUnitSwitch = {
        convert: convert,
        inchInMm: INCH_IN_MM
    };
})();

/* ==================================================
   MM / INCHES UNIT CONVERSION END
================================================== */
