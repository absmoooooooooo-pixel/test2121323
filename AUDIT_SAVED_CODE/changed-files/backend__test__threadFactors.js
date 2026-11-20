/*
 * Regression tests for the nut/bolt thread system.
 *
 * Metric and Unified inch threads use different stress-area constants for the
 * reported mechanical reference area. Physical thread volume now uses a
 * geometric major/root-area approximation, so stress area must not drive the
 * weight. These checks also confirm the lock-nut breakdown agrees with volume.
 */
"use strict";

const assert = require("assert");
const nutBolt = require("../calculations/nutBolt");

const close = (actual, expected, tolerance, label) => {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        label + ": expected " + expected + ", got " + actual
    );
};

const inchBolt = {
    product: "hex-ft",
    values: {
        diameter: 0.5,
        pitch: 1 / 13,
        length: 2,
        acrossFlats: 0.75,
        headHeight: 0.323
    },
    unit: "in",
    density: 7.85,
    quantity: 1
};

const asme = nutBolt.compute({ ...inchBolt, standard: "asme-b18-2-1" });
const customInch = nutBolt.compute({ ...inchBolt, standard: "custom" });

close(asme.stressAreaMM2, 91.5472, 1e-3, "ASME stress area");
close(asme.threadMaterialAreaMM2, 105.0232, 1e-3, "ASME physical thread area");
close(asme.singleWeight, 0.061829, 1e-6, "ASME single weight (kg)");
close(customInch.stressAreaMM2, asme.stressAreaMM2, 1e-9, "custom inch stress area");

const metric = nutBolt.compute({
    product: "hex-ft",
    values: {
        diameter: 12,
        pitch: 1.75,
        length: 50,
        acrossFlats: 18,
        headHeight: 7.5
    },
    unit: "mm",
    density: 7.85,
    quantity: 1,
    standard: "iso-4017"
});

close(metric.stressAreaMM2, 84.2664, 1e-3, "ISO M12 stress area");
close(metric.threadMaterialAreaMM2, 94.6724, 1e-3, "ISO M12 physical thread area");
close(nutBolt.threadStressArea(12, 1.75), metric.stressAreaMM2, 1e-9,
    "exported metric stress area");
close(nutBolt.threadMaterialArea(12, 1.75), metric.threadMaterialAreaMM2, 1e-9,
    "exported metric physical thread area");

const lockNut = nutBolt.compute({
    product: "lock-nut",
    values: { diameter: 12, pitch: 1.75, acrossFlats: 18, nutHeight: 14.9 },
    unit: "mm",
    density: 7.85,
    quantity: 1,
    standard: "iso-7040"
});

close(
    lockNut.headVolumeMM3 - lockNut.socketVolumeMM3,
    lockNut.volumeMM3,
    1e-6,
    "lock-nut volume breakdown"
);

console.log("PASS — thread systems and lock-nut breakdown are consistent.");
