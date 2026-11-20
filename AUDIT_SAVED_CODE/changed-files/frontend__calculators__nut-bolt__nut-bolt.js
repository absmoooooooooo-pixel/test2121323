/* ==================================================
   NUT AND BOLT WEIGHT CALCULATOR START
   Bolts, studs and nuts: product tables, drawings,
   unit conversion, validation, results and history.

   The engineering formulas run on the server
   (backend/calculations/nutBolt.js); this file only
   collects the inputs and displays the answer.
================================================== */
"use strict";

(function () {
    /* ==================================================
       CONSTANTS
    ================================================== */
    var INCH = 25.4;                       // millimetres in one inch
    var LBS_PER_KG = 2.2046226218;         // pounds in one kilogram
    var NYLON_INSERT_MM = 1.5;             // lock nut collar that is not metal

    /* Densities come from the server through /api/bootstrap.js. The local
       copy is only a fallback if that request failed. */
    var MATERIALS = window.MW_MATERIALS || {
        "carbon-steel": { name: "Carbon Steel", density: 7.85 },
        "stainless-steel": { name: "Stainless Steel", density: 8.00 },
        "aluminium": { name: "Aluminium", density: 2.70 },
        "brass": { name: "Brass", density: 8.45 },
        "bronze": { name: "Bronze", density: 8.73 },
        "cast-iron": { name: "Cast Iron", density: 7.20 },
        "copper": { name: "Copper", density: 8.96 }
    };

    var $ = function (id) {
        return document.getElementById(id);
    };

    /* Elements used again and again. */
    var categoryTabs = document.querySelectorAll(".category-tab");
    var productSelect = $("productSelect");
    var standardSelect = $("standardSelect");
    var sizeSelect = $("sizeSelect");
    var standardNote = $("standardNote");
    var dimensionFields = $("dimensionFields");
    var dimensionNote = $("dimensionNote");
    var dimensionUnitBanner = $("dimensionUnitBanner");
    var unitNote = $("unitNote");
    var diagramViews = $("fastenerDiagramViews");
    var drawingCaption = $("drawingCaption");
    var mmBtn = $("mmBtn");
    var inchBtn = $("inchBtn");
    var materialSelect = $("material");
    var customDensityBox = $("customBox");
    var customDensity = $("customDensity");
    var densityInfo = $("densityInfo");
    var quantity = $("quantity");
    var calculateBtn = $("calculateBtn");
    var resetBtn = $("resetBtn");
    var errorBox = $("error");
    var results = $("results");

    /* The shared calculation-history script reads this record after every
       successful Calculate click, exactly as it does on the other pages. */
    var lastCalculation = null;

    /* ==================================================
       DIMENSION FIELDS
       Every product picks the fields it needs from here,
       so the page never shows an input that does not apply.
    ================================================== */
    var FIELD_DEFS = {
        diameter: {
            label: "Nominal Thread Diameter",
            symbol: "d",
            hint: "Thread size, for example M12"
        },
        pitch: {
            label: "Thread Pitch",
            symbol: "P",
            hint: "Distance from one thread to the next"
        },
        length: {
            label: "Overall Length",
            symbol: "L",
            hint: "Measured from the bearing face under the head to the end"
        },
        threadLength: {
            label: "Thread Length",
            symbol: "b",
            hint: "Threaded length at the end"
        },
        threadLength2: {
            label: "Second Thread Length",
            symbol: "b2",
            hint: "Threaded length at the other end"
        },
        acrossFlats: {
            label: "Width Across Flats",
            symbol: "s",
            hint: "Wrench size, flat to flat"
        },
        headHeight: {
            label: "Head Height",
            symbol: "k",
            hint: "Height of the head"
        },
        headDiameter: {
            label: "Head Diameter",
            symbol: "dk",
            hint: "Widest diameter of the head"
        },
        socketAcrossFlats: {
            label: "Socket Width Across Flats",
            symbol: "s",
            hint: "Hex key size of the socket"
        },
        socketDepth: {
            label: "Socket Depth",
            symbol: "t",
            hint: "Depth of the hexagon socket"
        },
        neckAcrossFlats: {
            label: "Square Neck Width",
            symbol: "a",
            hint: "Width of the square neck"
        },
        neckHeight: {
            label: "Square Neck Height",
            symbol: "f",
            hint: "Height of the square neck"
        },
        nutHeight: {
            label: "Nut Height",
            symbol: "m",
            hint: "Nut thickness, face to face"
        }
    };

    /* ==================================================
       STANDARD SIZE TABLES
       All values are stored in millimetres. Inch tables are
       converted from inches once, when the page loads.
    ================================================== */
    function inchValue(value) {
        return value * INCH;
    }

    function boltSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: row[1],
                    pitch: row[2],
                    acrossFlats: row[3],
                    headHeight: row[4]
                }
            };
        });
    }

    function socketSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: row[1],
                    pitch: row[2],
                    headDiameter: row[3],
                    headHeight: row[4],
                    socketAcrossFlats: row[5],
                    socketDepth: row[6]
                }
            };
        });
    }

    function countersunkSizes(rows) {
        return socketSizes(rows);
    }

    function carriageSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                threadBase: row[6],
                values: {
                    diameter: row[1],
                    pitch: row[2],
                    headDiameter: row[3],
                    headHeight: row[4],
                    neckAcrossFlats: row[5],
                    neckHeight: row[7]
                }
            };
        });
    }

    function studSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: row[1],
                    pitch: row[2]
                }
            };
        });
    }

    function nutSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: row[1],
                    pitch: row[2],
                    acrossFlats: row[3],
                    nutHeight: row[4]
                }
            };
        });
    }

    function asmeBoltSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                threadBase: inchValue(row[5]),
                values: {
                    diameter: inchValue(row[1]),
                    pitch: inchValue(1 / row[2]),
                    acrossFlats: inchValue(row[3]),
                    headHeight: inchValue(row[4])
                }
            };
        });
    }

    function asmeNutSizes(rows) {
        return rows.map(function (row) {
            return {
                label: row[0],
                values: {
                    diameter: inchValue(row[1]),
                    pitch: inchValue(1 / row[2]),
                    acrossFlats: inchValue(row[3]),
                    nutHeight: inchValue(row[4])
                }
            };
        });
    }

    /* ISO 4014 / 4017 hexagon head dimensions (mm). */
    var ISO_BOLT_SIZES = boltSizes([
        ["M1.6", 1.6, 0.35, 3.2, 1.1],
        ["M2", 2, 0.4, 4, 1.4],
        ["M2.5", 2.5, 0.45, 5, 1.7],
        ["M3", 3, 0.5, 5.5, 2],
        ["M3.5", 3.5, 0.6, 6, 2.4],
        ["M4", 4, 0.7, 7, 2.8],
        ["M5", 5, 0.8, 8, 3.5],
        ["M6", 6, 1, 10, 4],
        ["M7", 7, 1, 11, 4.8],
        ["M8", 8, 1.25, 13, 5.3],
        ["M10", 10, 1.5, 16, 6.4],
        ["M12", 12, 1.75, 18, 7.5],
        ["M14", 14, 2, 21, 8.8],
        ["M16", 16, 2, 24, 10],
        ["M18", 18, 2.5, 27, 11.5],
        ["M20", 20, 2.5, 30, 12.5],
        ["M22", 22, 2.5, 34, 14],
        ["M24", 24, 3, 36, 15],
        ["M27", 27, 3, 41, 17],
        ["M30", 30, 3.5, 46, 18.7],
        ["M33", 33, 3.5, 50, 21],
        ["M36", 36, 4, 55, 22.5],
        ["M39", 39, 4, 60, 25],
        ["M42", 42, 4.5, 65, 26],
        ["M45", 45, 4.5, 70, 28],
        ["M48", 48, 5, 75, 30],
        ["M52", 52, 5, 80, 33],
        ["M56", 56, 5.5, 85, 35],
        ["M60", 60, 5.5, 90, 38],
        ["M64", 64, 6, 95, 40]
    ]);

    /* ISO 4762 socket head cap screws (mm): d, P, dk, k, socket s, t. */
    var ISO_4762_SIZES = socketSizes([
        ["M1.6", 1.6, 0.35, 3, 1.6, 1.5, 0.7],
        ["M2", 2, 0.4, 3.8, 2, 1.5, 1],
        ["M2.5", 2.5, 0.45, 4.5, 2.5, 2, 1.1],
        ["M3", 3, 0.5, 5.5, 3, 2.5, 1.3],
        ["M4", 4, 0.7, 7, 4, 3, 2],
        ["M5", 5, 0.8, 8.5, 5, 4, 2.5],
        ["M6", 6, 1, 10, 6, 5, 3],
        ["M8", 8, 1.25, 13, 8, 6, 4],
        ["M10", 10, 1.5, 16, 10, 8, 5],
        ["M12", 12, 1.75, 18, 12, 10, 6],
        ["M14", 14, 2, 21, 14, 12, 7],
        ["M16", 16, 2, 24, 16, 14, 8],
        ["M20", 20, 2.5, 30, 20, 17, 10],
        ["M24", 24, 3, 36, 24, 19, 12],
        ["M30", 30, 3.5, 45, 30, 22, 15.5],
        ["M36", 36, 4, 54, 36, 27, 19],
        ["M42", 42, 4.5, 63, 42, 32, 24],
        ["M48", 48, 5, 72, 48, 36, 28],
        ["M56", 56, 5.5, 84, 56, 41, 34],
        ["M64", 64, 6, 96, 64, 46, 38]
    ]);

    /* ISO 10642 countersunk socket screws (mm). */
    var ISO_10642_SIZES = countersunkSizes([
        ["M2", 2, 0.4, 4.7, 1.35, 1.3, 0.75],
        ["M2.5", 2.5, 0.45, 5.88, 1.69, 1.5, 1],
        ["M3", 3, 0.5, 6.72, 1.86, 2, 1.1],
        ["M4", 4, 0.7, 8.96, 2.48, 2.5, 1.5],
        ["M5", 5, 0.8, 11.2, 3.1, 3, 1.9],
        ["M6", 6, 1, 13.44, 3.72, 4, 2.2],
        ["M8", 8, 1.25, 17.92, 4.96, 5, 3],
        ["M10", 10, 1.5, 22.4, 6.2, 6, 3.6],
        ["M12", 12, 1.75, 26.88, 7.44, 8, 4.3],
        ["M14", 14, 2, 30.8, 8.4, 10, 4.5],
        ["M16", 16, 2, 33.6, 8.8, 10, 4.8],
        ["M20", 20, 2.5, 40.32, 10.16, 12, 5.6]
    ]);

    /* DIN 7991 countersunk socket screws (mm). */
    var DIN_7991_SIZES = countersunkSizes([
        ["M3", 3, 0.5, 6, 1.7, 2, 0.95],
        ["M4", 4, 0.7, 8, 2.3, 2.5, 1.5],
        ["M5", 5, 0.8, 10, 2.8, 3, 2.05],
        ["M6", 6, 1, 12, 3.3, 4, 2.25],
        ["M8", 8, 1.25, 16, 4.4, 5, 3.2],
        ["M10", 10, 1.5, 20, 5.5, 6, 4.1],
        ["M12", 12, 1.75, 24, 6.5, 8, 4.3],
        ["M14", 14, 2, 27, 7, 10, 4.5],
        ["M16", 16, 2, 30, 7.5, 10, 5],
        ["M18", 18, 2.5, 33, 8, 12, 5.2],
        ["M20", 20, 2.5, 36, 8.5, 12, 5.6]
    ]);

    /* DIN 603 carriage bolts (mm): d, P, dk, k, square a, f, b at L<=125. */
    var DIN_603_SIZES = carriageSizes([
        ["M5", 5, 0.8, 13.55, 3.3, 5.48, 16, 4.1],
        ["M6", 6, 1, 16.55, 3.88, 6.48, 18, 4.6],
        ["M8", 8, 1.25, 20.65, 4.88, 8.58, 22, 5.6],
        ["M10", 10, 1.5, 24.65, 5.38, 10.58, 26, 6.6],
        ["M12", 12, 1.75, 30.65, 6.95, 12.7, 30, 8.75],
        ["M16", 16, 2, 38.8, 8.95, 16.7, 38, 12.9],
        ["M20", 20, 2.5, 46.8, 11.05, 20.84, 46, 15.9]
    ]);

    /* DIN 976-1 and DIN 938 sizes use the metric coarse thread only. */
    var METRIC_STUD_SIZES = studSizes([
        ["M2", 2, 0.4],
        ["M2.5", 2.5, 0.45],
        ["M3", 3, 0.5],
        ["M4", 4, 0.7],
        ["M5", 5, 0.8],
        ["M6", 6, 1],
        ["M8", 8, 1.25],
        ["M10", 10, 1.5],
        ["M12", 12, 1.75],
        ["M14", 14, 2],
        ["M16", 16, 2],
        ["M18", 18, 2.5],
        ["M20", 20, 2.5],
        ["M22", 22, 2.5],
        ["M24", 24, 3],
        ["M27", 27, 3],
        ["M30", 30, 3.5],
        ["M33", 33, 3.5],
        ["M36", 36, 4],
        ["M39", 39, 4],
        ["M42", 42, 4.5],
        ["M45", 45, 4.5],
        ["M48", 48, 5],
        ["M52", 52, 5],
        ["M56", 56, 5.5],
        ["M60", 60, 5.5],
        ["M64", 64, 6]
    ]);

    /* ISO 4032 hexagon regular nuts (style 1). */
    var ISO_4032_SIZES = nutSizes([
        ["M1.6", 1.6, 0.35, 3.2, 1.3],
        ["M2", 2, 0.4, 4, 1.6],
        ["M2.5", 2.5, 0.45, 5, 2],
        ["M3", 3, 0.5, 5.5, 2.4],
        ["M4", 4, 0.7, 7, 3.2],
        ["M5", 5, 0.8, 8, 4.7],
        ["M6", 6, 1, 10, 5.2],
        ["M7", 7, 1, 11, 6.5],
        ["M8", 8, 1.25, 13, 6.8],
        ["M10", 10, 1.5, 16, 8.4],
        ["M12", 12, 1.75, 18, 10.8],
        ["M14", 14, 2, 21, 12.8],
        ["M16", 16, 2, 24, 14.8],
        ["M18", 18, 2.5, 27, 15.8],
        ["M20", 20, 2.5, 30, 18],
        ["M22", 22, 2.5, 34, 19.4],
        ["M24", 24, 3, 36, 21.5],
        ["M27", 27, 3, 41, 23.8],
        ["M30", 30, 3.5, 46, 25.6],
        ["M33", 33, 3.5, 50, 28.7],
        ["M36", 36, 4, 55, 31],
        ["M39", 39, 4, 60, 33.4],
        ["M42", 42, 4.5, 65, 34],
        ["M48", 48, 5, 75, 38],
        ["M56", 56, 5.5, 85, 45],
        ["M64", 64, 6, 95, 51]
    ]);

    /* ISO 4033 hexagon high nuts (style 2). */
    var ISO_4033_SIZES = nutSizes([
        ["M6", 6, 1, 10, 5.7],
        ["M8", 8, 1.25, 13, 7.5],
        ["M10", 10, 1.5, 16, 9.3],
        ["M12", 12, 1.75, 18, 12],
        ["M14", 14, 2, 21, 14.1],
        ["M16", 16, 2, 24, 16.4],
        ["M18", 18, 2.5, 27, 17.6],
        ["M20", 20, 2.5, 30, 20.3],
        ["M24", 24, 3, 36, 23.9],
        ["M30", 30, 3.5, 46, 28.6],
        ["M36", 36, 4, 55, 34.7]
    ]);

    /* ISO 4035 hexagon thin nuts (jam nuts). */
    var ISO_4035_SIZES = nutSizes([
        ["M5", 5, 0.8, 8, 2.7],
        ["M6", 6, 1, 10, 3.2],
        ["M8", 8, 1.25, 13, 4],
        ["M10", 10, 1.5, 16, 5],
        ["M12", 12, 1.75, 18, 6],
        ["M14", 14, 2, 21, 7],
        ["M16", 16, 2, 24, 8],
        ["M20", 20, 2.5, 30, 10],
        ["M24", 24, 3, 36, 12],
        ["M30", 30, 3.5, 46, 15],
        ["M36", 36, 4, 55, 18]
    ]);

    /* ISO 7040 nylon insert lock nuts (height includes the collar). */
    var ISO_7040_SIZES = nutSizes([
        ["M5", 5, 0.8, 8, 6.8],
        ["M6", 6, 1, 10, 8],
        ["M8", 8, 1.25, 13, 9.5],
        ["M10", 10, 1.5, 16, 11.9],
        ["M12", 12, 1.75, 18, 14.9],
        ["M16", 16, 2, 24, 19.1],
        ["M20", 20, 2.5, 30, 22.8],
        ["M24", 24, 3, 36, 27.1],
        ["M30", 30, 3.5, 46, 32.6],
        ["M36", 36, 4, 55, 38.9]
    ]);

    /* DIN 557 square nuts. */
    var DIN_557_SIZES = nutSizes([
        ["M8", 8, 1.25, 13, 6.5],
        ["M10", 10, 1.5, 17, 8],
        ["M12", 12, 1.75, 19, 10],
        ["M16", 16, 2, 24, 13],
        ["M20", 20, 2.5, 30, 16],
        ["M24", 24, 3, 36, 19]
    ]);

    /* ASME B18.2.1 hex cap screws (inch -> mm on load). */
    var ASME_BOLT_SIZES = asmeBoltSizes([
        ["1/4-20 UNC", 0.25, 20, 0.4375, 0.163, 0.75],
        ["5/16-18 UNC", 0.3125, 18, 0.5, 0.211, 0.875],
        ["3/8-16 UNC", 0.375, 16, 0.5625, 0.243, 1],
        ["7/16-14 UNC", 0.4375, 14, 0.625, 0.291, 1.125],
        ["1/2-13 UNC", 0.5, 13, 0.75, 0.323, 1.25],
        ["9/16-12 UNC", 0.5625, 12, 0.8125, 0.371, 1.375],
        ["5/8-11 UNC", 0.625, 11, 0.9375, 0.403, 1.5],
        ["3/4-10 UNC", 0.75, 10, 1.125, 0.483, 1.75],
        ["7/8-9 UNC", 0.875, 9, 1.3125, 0.563, 2],
        ["1-8 UNC", 1, 8, 1.5, 0.627, 2.25]
    ]);

    /* ASME B18.2.2 hex nuts (inch, maximum thickness). */
    var ASME_NUT_SIZES = asmeNutSizes([
        ["1/4-20 UNC", 0.25, 20, 0.4375, 0.226],
        ["5/16-18 UNC", 0.3125, 18, 0.5, 0.273],
        ["3/8-16 UNC", 0.375, 16, 0.5625, 0.337],
        ["7/16-14 UNC", 0.4375, 14, 0.6875, 0.385],
        ["1/2-13 UNC", 0.5, 13, 0.75, 0.448],
        ["9/16-12 UNC", 0.5625, 12, 0.875, 0.496],
        ["5/8-11 UNC", 0.625, 11, 0.9375, 0.559],
        ["3/4-10 UNC", 0.75, 10, 1.125, 0.665],
        ["7/8-9 UNC", 0.875, 9, 1.3125, 0.776],
        ["1-8 UNC", 1, 8, 1.5, 0.887]
    ]);

    /* ASME B18.2.2 heavy hex nuts. */
    var ASME_HEAVY_NUT_SIZES = asmeNutSizes([
        ["1/4-20 UNC", 0.25, 20, 0.5, 0.25],
        ["5/16-18 UNC", 0.3125, 18, 0.5625, 0.314],
        ["3/8-16 UNC", 0.375, 16, 0.6875, 0.377],
        ["7/16-14 UNC", 0.4375, 14, 0.75, 0.441],
        ["1/2-13 UNC", 0.5, 13, 0.875, 0.504],
        ["9/16-12 UNC", 0.5625, 12, 0.9375, 0.568],
        ["5/8-11 UNC", 0.625, 11, 1.0625, 0.631],
        ["3/4-10 UNC", 0.75, 10, 1.25, 0.758],
        ["7/8-9 UNC", 0.875, 9, 1.4375, 0.885],
        ["1-8 UNC", 1, 8, 1.625, 1.012]
    ]);

    function customStandard() {
        return {
            id: "custom",
            name: "Custom dimensions",
            sizes: []
        };
    }

    /* ==================================================
       PRODUCT CATALOGUE
       fields       inputs shown for the product
       drawing      which engineering drawing to draw
       defaultSize  size selected when the product opens
       defaultLength length in mm used for the first view
    ================================================== */
    var PRODUCTS = {
        "hex-ft": {
            name: "Hex Bolt, Full Thread",
            shortName: "Hex Bolt (FT)",
            category: "bolts",
            drawing: "hex",
            fields: ["diameter", "pitch", "length", "acrossFlats", "headHeight"],
            defaultSize: "M10",
            defaultLength: 50,
            standards: [
                { id: "iso-4017", name: "ISO 4017 (metric)", sizes: ISO_BOLT_SIZES, metric: true },
                { id: "asme-b18-2-1", name: "ASME B18.2.1 (inch)", sizes: ASME_BOLT_SIZES, inch: true },
                customStandard()
            ]
        },
        "hex-ht": {
            name: "Hex Bolt, Half Thread",
            shortName: "Hex Bolt (HT)",
            category: "bolts",
            drawing: "hex",
            fields: ["diameter", "pitch", "length", "threadLength", "acrossFlats", "headHeight"],
            defaultSize: "M10",
            defaultLength: 80,
            standards: [
                { id: "iso-4014", name: "ISO 4014 (metric)", sizes: ISO_BOLT_SIZES, metric: true },
                { id: "asme-b18-2-1", name: "ASME B18.2.1 (inch)", sizes: ASME_BOLT_SIZES, inch: true },
                customStandard()
            ]
        },
        "hex-blank": {
            name: "Hex Bolt Blank",
            shortName: "Hex Bolt Blank",
            category: "bolts",
            drawing: "blank",
            fields: ["diameter", "length", "acrossFlats", "headHeight"],
            defaultSize: "M12",
            defaultLength: 100,
            standards: [
                { id: "iso-4014", name: "ISO 4014 / 4017 head (metric)", sizes: ISO_BOLT_SIZES, metric: true },
                { id: "asme-b18-2-1", name: "ASME B18.2.1 head (inch)", sizes: ASME_BOLT_SIZES, inch: true },
                customStandard()
            ]
        },
        "socket-head": {
            name: "Socket Head Cap Screw",
            shortName: "Socket Head Cap Screw",
            category: "bolts",
            drawing: "socket",
            fields: ["diameter", "pitch", "length", "threadLength", "headDiameter",
                "headHeight", "socketAcrossFlats", "socketDepth"],
            defaultSize: "M10",
            defaultLength: 40,
            standards: [
                { id: "iso-4762", name: "ISO 4762 (metric)", sizes: ISO_4762_SIZES, metric: true },
                { id: "din-912", name: "DIN 912 (metric)", sizes: ISO_4762_SIZES, metric: true },
                customStandard()
            ]
        },
        "countersunk": {
            name: "Countersunk Socket Screw",
            shortName: "Countersunk Screw",
            category: "bolts",
            drawing: "countersunk",
            fields: ["diameter", "pitch", "length", "threadLength", "headDiameter",
                "headHeight", "socketAcrossFlats", "socketDepth"],
            defaultSize: "M10",
            defaultLength: 40,
            standards: [
                { id: "iso-10642", name: "ISO 10642 (metric)", sizes: ISO_10642_SIZES, metric: true },
                { id: "din-7991", name: "DIN 7991 (metric)", sizes: DIN_7991_SIZES, metric: true },
                customStandard()
            ]
        },
        "carriage": {
            name: "Carriage Bolt",
            shortName: "Carriage Bolt",
            category: "bolts",
            drawing: "carriage",
            fields: ["diameter", "pitch", "length", "threadLength", "headDiameter",
                "headHeight", "neckAcrossFlats", "neckHeight"],
            defaultSize: "M10",
            defaultLength: 100,
            standards: [
                { id: "din-603", name: "DIN 603 (metric)", sizes: DIN_603_SIZES, metric: true },
                customStandard()
            ]
        },
        "stud-ft": {
            name: "Fully Threaded Stud",
            shortName: "Fully Threaded Stud",
            category: "studs",
            drawing: "stud",
            fields: ["diameter", "pitch", "length"],
            defaultSize: "M12",
            defaultLength: 300,
            standards: [
                { id: "din-976-1", name: "DIN 976-1 (metric)", sizes: METRIC_STUD_SIZES, metric: true },
                customStandard()
            ]
        },
        "stud-de": {
            name: "Double End Stud",
            shortName: "Double End Stud",
            category: "studs",
            drawing: "stud-de",
            fields: ["diameter", "pitch", "length", "threadLength", "threadLength2"],
            defaultSize: "M12",
            defaultLength: 200,
            standards: [
                { id: "din-938", name: "DIN 938 (metric)", sizes: METRIC_STUD_SIZES, metric: true },
                customStandard()
            ]
        },
        "threaded-rod": {
            name: "Threaded Rod",
            shortName: "Threaded Rod",
            category: "studs",
            drawing: "stud",
            fields: ["diameter", "pitch", "length"],
            defaultSize: "M12",
            defaultLength: 1000,
            standards: [
                { id: "din-976-1", name: "DIN 976-1 (metric)", sizes: METRIC_STUD_SIZES, metric: true },
                customStandard()
            ]
        },
        "hex-nut": {
            name: "Hex Nut",
            shortName: "Hex Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M12",
            standards: [
                { id: "iso-4032", name: "ISO 4032 (metric)", sizes: ISO_4032_SIZES, metric: true },
                { id: "asme-b18-2-2", name: "ASME B18.2.2 (inch)", sizes: ASME_NUT_SIZES, inch: true },
                customStandard()
            ]
        },
        "heavy-hex-nut": {
            name: "Heavy Hex Nut",
            shortName: "Heavy Hex Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M20",
            standards: [
                { id: "iso-4033", name: "ISO 4033 (metric)", sizes: ISO_4033_SIZES, metric: true },
                { id: "asme-b18-2-2-heavy", name: "ASME B18.2.2 heavy (inch)", sizes: ASME_HEAVY_NUT_SIZES, inch: true },
                customStandard()
            ]
        },
        "jam-nut": {
            name: "Hex Jam Nut",
            shortName: "Hex Jam Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M12",
            standards: [
                { id: "iso-4035", name: "ISO 4035 (metric)", sizes: ISO_4035_SIZES, metric: true },
                customStandard()
            ]
        },
        "square-nut": {
            name: "Square Nut",
            shortName: "Square Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M12",
            standards: [
                { id: "din-557", name: "DIN 557 (metric)", sizes: DIN_557_SIZES, metric: true },
                customStandard()
            ]
        },
        "lock-nut": {
            name: "Nylon Insert Lock Nut",
            shortName: "Lock Nut",
            category: "nuts",
            drawing: "nut",
            fields: ["diameter", "pitch", "acrossFlats", "nutHeight"],
            defaultSize: "M12",
            standards: [
                { id: "iso-7040", name: "ISO 7040 (metric)", sizes: ISO_7040_SIZES, metric: true },
                customStandard()
            ]
        }
    };

    /* Remember the catalogue key on each product, so the drawing and the
       calculation can recognise the product they are working on. */
    Object.keys(PRODUCTS).forEach(function (key) {
        PRODUCTS[key].key = key;
    });

    /* ==================================================
       PAGE STATE
    ================================================== */
    var state = {
        category: "bolts",
        productKey: "hex-ft",
        standardId: "iso-4017",
        sizeLabel: "M10",
        unit: "mm",
        touched: {},
        /* The exact millimetre value behind each input. Unit changes are
           converted from here, so repeated switches never drift. */
        mmValues: {}
    };

    var lastProductByCategory = {};
    var isCalculating = false;

    /* ==================================================
       SMALL HELPERS
    ================================================== */
    function currentProduct() {
        return PRODUCTS[state.productKey];
    }

    function currentStandard() {
        var standards = currentProduct().standards;
        var found = standards[0];

        standards.forEach(function (standard) {
            if (standard.id === state.standardId) {
                found = standard;
            }
        });

        return found;
    }

    function currentSize() {
        var standard = currentStandard();

        if (!standard.sizes.length) {
            return null;
        }

        var found = null;

        standard.sizes.forEach(function (size) {
            if (size.label === state.sizeLabel) {
                found = size;
            }
        });

        return found || standard.sizes[0];
    }

    function unitLabel() {
        return state.unit === "in" ? "in" : "mm";
    }

    function mmFactor() {
        return state.unit === "in" ? INCH : 1;
    }

    function fieldInput(key) {
        return document.getElementById("field-" + key);
    }

    function readFieldMM(key) {
        var input = fieldInput(key);

        if (!input || input.value.trim() === "") {
            return NaN;
        }

        var value = Number(input.value);

        return isFinite(value) ? value * mmFactor() : NaN;
    }

    function formatInputNumber(value) {
        if (!isFinite(value)) {
            return "";
        }

        /* Inches need four decimals to keep a millimetre value exact; three
           are enough for millimetres themselves. */
        var rounded = Number(value.toFixed(state.unit === "in" ? 4 : 3));

        return String(rounded);
    }

    function setFieldValue(key, mmValue) {
        var input = fieldInput(key);

        if (!input || !isFinite(mmValue)) {
            return;
        }

        input.value = formatInputNumber(mmValue / mmFactor());
        state.mmValues[key] = mmValue;
    }

    /* Remembers the physical value of a field the user has just typed in. */
    function rememberMMValue(key) {
        var input = fieldInput(key);
        var value = input ? Number(input.value) : NaN;

        if (input && input.value.trim() !== "" && isFinite(value) && value > 0) {
            state.mmValues[key] = value * mmFactor();
        } else {
            delete state.mmValues[key];
        }
    }

    function formatNumber(value, decimals) {
        if (!isFinite(value)) {
            return "0";
        }

        return value.toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function weightDecimals(value) {
        return Math.abs(value) < 0.1 ? 4 : 3;
    }

    function formatKg(value) {
        return formatNumber(value, weightDecimals(value)) + " kg";
    }

    function formatLbs(value) {
        return formatNumber(value, weightDecimals(value)) + " lbs";
    }

    /* A value in mm, shown in the unit currently on screen. */
    function formatDimension(mmValue) {
        if (!isFinite(mmValue) || mmValue <= 0) {
            return "—";
        }

        var value = state.unit === "in" ? mmValue / INCH : mmValue;
        var decimals = state.unit === "in" ? 3 : (value < 10 ? 2 : 1);

        return formatNumber(value, decimals) + " " + unitLabel();
    }

    function clearError() {
        errorBox.textContent = "";
    }

    function showError(message, input) {
        errorBox.textContent = message;

        if (input) {
            input.classList.add("invalid");
            input.setAttribute("aria-invalid", "true");
            input.focus();
        }
    }

    function clearInvalid() {
        document.querySelectorAll(".invalid").forEach(function (element) {
            element.classList.remove("invalid");
            element.removeAttribute("aria-invalid");
        });
    }

    function hideResults() {
        results.classList.remove("visible");
    }

    function clearResultState() {
        hideResults();
        clearError();
        clearInvalid();
    }

    /* ==================================================
       STANDARD THREAD LENGTHS
       The bolt standards fix the thread length from the
       diameter and the overall length.
    ================================================== */
    function isoThreadLength(length, diameter) {
        if (length <= 125) {
            return 2 * diameter + 6;
        }

        if (length <= 200) {
            return 2 * diameter + 12;
        }

        return 2 * diameter + 25;
    }

    function asmeThreadLength(size, length) {
        if (!size) {
            return length;
        }

        /* A tiny tolerance keeps a length of exactly 6 in on the shorter rule. */
        var extra = length > 6 * INCH + 0.000001 ? 0.25 * INCH : 0;

        return Math.min(size.threadBase + extra, length);
    }

    function din603ThreadLength(size, length) {
        if (!size) {
            return length;
        }

        var extra = length > 200 ? 19 : (length > 125 ? 6 : 0);

        return Math.min(size.threadBase + extra, length);
    }

    /* Recalculates thread length after the length, size or diameter changed.
       A field the user has typed in is never overwritten. */
    function applyThreadLengths() {
        var product = currentProduct();
        var standard = currentStandard();
        var size = currentSize();
        var length = readFieldMM("length");

        /* With custom dimensions every value, including the thread length, is
           typed by the user, so nothing is filled in automatically. */
        if (!standard.sizes.length) {
            return;
        }

        if (!isFinite(length) || length <= 0) {
            return;
        }

        if (product.key === "hex-ht" && !state.touched.threadLength) {
            var b = null;

            if (standard.inch) {
                b = asmeThreadLength(size, length);
            } else if (standard.metric) {
                b = isoThreadLength(length, readFieldMM("diameter"));
            } else {
                b = length * 0.6;
            }

            setFieldValue("threadLength", Math.min(b, length));
        }

        if ((product.key === "socket-head" || product.key === "countersunk") &&
            !state.touched.threadLength) {
            /* ISO 4762 and ISO 10642 use the standard partial-thread rule;
               only custom dimensions remain fully threaded by default. */
            var screwThread = standard.metric
                ? isoThreadLength(length, readFieldMM("diameter"))
                : length;

            setFieldValue("threadLength", Math.min(screwThread, length));
        }

        if (product.key === "carriage" && !state.touched.threadLength) {
            var carriageThread = standard.metric
                ? din603ThreadLength(size, length)
                : length;

            setFieldValue("threadLength", Math.min(carriageThread, length));
        }

        if (product.key === "stud-de") {
            /* DIN 938: the metal end is nominally 1 d and the nut end follows
               the same ISO thread-length rule as a hexagon head bolt. */
            var diameter = readFieldMM("diameter");

            if (!state.touched.threadLength) {
                setFieldValue("threadLength", Math.min(diameter, length));
            }

            if (!state.touched.threadLength2) {
                setFieldValue("threadLength2", isoThreadLength(length, diameter));
            }
        }
    }

    /* ==================================================
       UNIT BANNER AND PLACEHOLDERS
       The selected unit is shown once above the inputs. Dimension labels use
       engineering names and symbols only; drawing callouts keep their units.
    ================================================== */
    function updateFieldLabels() {
        if (dimensionUnitBanner) {
            dimensionUnitBanner.textContent = state.unit === "in"
                ? "ALL DIMENSIONS IN INCHES"
                : "ALL DIMENSIONS IN MM";
        }

        if (unitNote) {
            unitNote.textContent = state.unit === "in"
                ? "All dimensions are in inches. Internal calculation is performed in millimetres."
                : "All dimensions are in millimetres.";
        }

        document.querySelectorAll("[data-field]").forEach(function (input) {
            var key = input.dataset.field;
            input.placeholder = "Enter " + fieldLabel(key).toLowerCase();
        });

        quantity.placeholder = "Enter quantity";
    }

    function fieldLabel(key) {
        var field = FIELD_DEFS[key] || { label: key, symbol: "" };

        if (key === "length") {
            if (state.productKey === "stud-ft" || state.productKey === "stud-de" ||
                state.productKey === "threaded-rod") {
                return "Stud Length (" + field.symbol + ")";
            }

            if (state.productKey === "countersunk" || state.productKey === "socket-head") {
                return "Screw Length (" + field.symbol + ")";
            }

            return "Bolt Length (" + field.symbol + ")";
        }

        return field.label + " (" + field.symbol + ")";
    }

    function updateUnitButtons() {
        mmBtn.classList.toggle("active", state.unit === "mm");
        inchBtn.classList.toggle("active", state.unit === "in");
        mmBtn.setAttribute("aria-pressed", state.unit === "mm" ? "true" : "false");
        inchBtn.setAttribute("aria-pressed", state.unit === "in" ? "true" : "false");
    }

    /* ==================================================
       DIMENSION INPUTS
    ================================================== */
    function buildFields() {
        var product = currentProduct();

        dimensionFields.innerHTML = product.fields.map(function (key, index) {
            var field = FIELD_DEFS[key];
            var hint = index === product.fields.length - 1 ? "done" : "next";

            return '<div class="field">' +
                '<label for="field-' + key + '">' + fieldLabel(key) + '</label>' +
                '<input type="number" id="field-' + key + '" data-field="' + key + '"' +
                ' min="0" step="any" inputmode="decimal" enterkeyhint="' + hint + '"' +
                ' autocomplete="off" placeholder="Enter ' + fieldLabel(key).toLowerCase() + '">' +
                '<span class="field-hint">' + field.hint + '</span>' +
                '</div>';
        }).join("");

        updateFieldLabels();
    }

    /* ==================================================
       PRODUCT / STANDARD / SIZE SELECTION
    ================================================== */
    function populateProductSelect(preferredKey) {
        var keys = Object.keys(PRODUCTS).filter(function (key) {
            return PRODUCTS[key].category === state.category;
        });

        productSelect.innerHTML = keys.map(function (key) {
            return '<option value="' + key + '">' + PRODUCTS[key].name + '</option>';
        }).join("");

        var key = preferredKey && keys.indexOf(preferredKey) !== -1
            ? preferredKey
            : keys[0];

        productSelect.value = key;
        loadProduct(key);
    }

    function loadProduct(key) {
        var product = PRODUCTS[key];

        if (!product) {
            return;
        }

        state.productKey = key;
        state.touched = {};
        state.mmValues = {};
        lastProductByCategory[product.category] = key;

        standardSelect.innerHTML = product.standards.map(function (standard) {
            return '<option value="' + standard.id + '">' + standard.name + '</option>';
        }).join("");

        state.standardId = product.standards[0].id;
        standardSelect.value = state.standardId;

        buildFields();

        /* The length is not part of the size tables: it is chosen by the user. */
        if (product.fields.indexOf("length") !== -1) {
            setFieldValue("length", product.defaultLength);
        }

        populateSizes();
        renderDrawing();
        clearResultState();
        refreshNotes();
    }

    function populateSizes() {
        var product = currentProduct();
        var standard = currentStandard();

        if (!standard.sizes.length) {
            sizeSelect.innerHTML = '<option value="">Manual entry</option>';
            sizeSelect.disabled = true;
            state.sizeLabel = "";
            refreshNotes();
            renderDrawing();
            return;
        }

        sizeSelect.disabled = false;
        sizeSelect.innerHTML = standard.sizes.map(function (size) {
            return '<option value="' + size.label + '">' + size.label + '</option>';
        }).join("");

        var wanted = product.defaultSize;
        var exists = standard.sizes.some(function (size) {
            return size.label === state.sizeLabel;
        });

        if (state.sizeLabel && exists) {
            wanted = state.sizeLabel;
        } else if (!standard.sizes.some(function (size) { return size.label === wanted; })) {
            /* The metric default does not exist in an inch table: use 1/2". */
            var half = standard.sizes.filter(function (size) {
                return size.label.indexOf("1/2-13") === 0;
            });

            wanted = half.length ? half[0].label : standard.sizes[0].label;
        }

        sizeSelect.value = wanted;
        state.sizeLabel = wanted;
        applyPreset(currentSize());
    }

    function applyPreset(size) {
        if (!size) {
            renderDrawing();
            return;
        }

        Object.keys(size.values).forEach(function (key) {
            setFieldValue(key, size.values[key]);
        });

        state.touched = {};
        applyThreadLengths();
        renderDrawing();
    }

    /* ==================================================
       ENGINEERING DRAWINGS
       Every product gets a set of orthographic SVG views. Geometry is scaled
       from the actual millimetre inputs, so proportions follow the dimensions
       instead of a fixed illustration. Callouts keep their units; the input
       section shows the selected unit only once.
    ================================================== */
    function coord(value) {
        return Number(value).toFixed(1);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function fieldMM(key, fallback) {
        var value = readFieldMM(key);
        return isFinite(value) && value > 0 ? value : fallback;
    }

    function acrossCornersMM() {
        var s = fieldMM("acrossFlats", 16);
        return s / Math.cos(Math.PI / 6);
    }

    function pitchMM() {
        return fieldMM("pitch", 1.5);
    }

    function formatPitch(mm) {
        if (state.unit === "in") {
            var inch = mm / INCH;
            var tpi = inch > 0 ? 1 / inch : NaN;

            return formatNumber(inch, 4) + " in (" + formatNumber(tpi, 0) + " TPI)";
        }

        return formatDimension(mm);
    }

    /* The ISO bolt drawing is always labelled in millimetres. Values stay in
       the mm model regardless of the calculator's display unit. */
    function formatMMOnly(mmValue) {
        if (!isFinite(mmValue) || mmValue <= 0) {
            return "—";
        }

        return formatNumber(mmValue, mmValue < 10 ? 2 : 1) + " mm";
    }

    function dimTextMM(key, symbol) {
        var field = FIELD_DEFS[key];
        var label = symbol || (field ? field.symbol : key);
        var mm = readFieldMM(key);

        if (!isFinite(mm) || mm <= 0) {
            return label + " = —";
        }

        return label + " = " + formatMMOnly(mm);
    }

    function dimText(key, symbol) {
        var field = FIELD_DEFS[key];
        var label = symbol || (field ? field.symbol : key);

        if (key === "acrossCorners") {
            return "e = " + formatDimension(acrossCornersMM());
        }

        if (key === "pitch") {
            return "P = " + formatPitch(pitchMM());
        }

        var mm = readFieldMM(key);

        if (!isFinite(mm) || mm <= 0) {
            return label + " = —";
        }

        return label + " = " + formatDimension(mm);
    }

    function lineMarkup(cls, x1, y1, x2, y2, extra) {
        return '<line class="' + cls + '" x1="' + coord(x1) + '" y1="' + coord(y1) +
            '" x2="' + coord(x2) + '" y2="' + coord(y2) + '"' + (extra || "") + '/>';
    }

    function polygonMarkup(cls, points, extra) {
        return '<polygon class="' + cls + '" points="' + points + '"' + (extra || "") + '/>';
    }

    function circleMarkup(cls, cx, cy, r, extra) {
        return '<circle class="' + cls + '" cx="' + coord(cx) + '" cy="' + coord(cy) +
            '" r="' + coord(r) + '"' + (extra || "") + '/>';
    }

    function pathMarkup(cls, d, extra) {
        return '<path class="' + cls + '" d="' + d + '"' + (extra || "") + '/>';
    }

    function labelMarkup(key, x, y, anchor, symbol, rotate, overrideText, mmOnly) {
        var transform = rotate ? ' transform="rotate(-90 ' + coord(x) + " " + coord(y) + ')"' : "";
        var text = overrideText || (mmOnly ? dimTextMM(key, symbol) : dimText(key, symbol));

        return '<text class="fastener-label" x="' + coord(x) + '" y="' + coord(y) +
            '" text-anchor="' + (anchor || "middle") + '" data-dim="' + key +
            '" data-symbol="' + (symbol || "") + '"' +
            (mmOnly ? ' data-unit-mode="mm"' : '') + transform + '>' + text + '</text>';
    }

    function dimH(x1, x2, y, key, options) {
        var opts = options || {};
        var fromY = opts.fromY === undefined ? null :
            (Array.isArray(opts.fromY) ? opts.fromY : [opts.fromY, opts.fromY]);
        var extensions = "";

        if (fromY) {
            extensions = lineMarkup("fastener-ext", x1, fromY[0], x1, y + 6) +
                lineMarkup("fastener-ext", x2, fromY[1], x2, y + 6);
        }

        return extensions +
            lineMarkup("fastener-dim", x1, y, x2, y,
                ' marker-start="url(#' + opts.arrow + ')" marker-end="url(#' + opts.arrow + ')"') +
            labelMarkup(key, (x1 + x2) / 2, y + (opts.labelBelow ? 19 : -9),
                "middle", opts.symbol, false, null, opts.mmOnly);
    }

    function dimV(y1, y2, x, key, options) {
        var opts = options || {};
        var side = opts.side || "right";
        var mid = (y1 + y2) / 2;
        var fromX = opts.fromX === undefined ? null :
            (Array.isArray(opts.fromX) ? opts.fromX : [opts.fromX, opts.fromX]);
        var pastX = x + (side === "left" ? -6 : 6);
        var extensions = "";

        if (fromX) {
            extensions = lineMarkup("fastener-ext", fromX[0], y1, pastX, y1) +
                lineMarkup("fastener-ext", fromX[1], y2, pastX, y2);
        }

        return extensions +
            lineMarkup("fastener-dim", x, y1, x, y2,
                ' marker-start="url(#' + opts.arrow + ')" marker-end="url(#' + opts.arrow + ')"') +
            labelMarkup(key, x + (side === "left" ? -9 : 9), mid, "middle",
                opts.symbol, true, null, opts.mmOnly);
    }

    function leaderMarkup(x1, y1, x2, y2, key, symbol, overrideText, mmOnly) {
        var anchor = x2 >= x1 ? "start" : "end";
        var textX = x2 + (anchor === "start" ? 7 : -7);

        return circleMarkup("fastener-point", x1, y1, 2.4) +
            lineMarkup("fastener-ext", x1, y1, x2, y2) +
            labelMarkup(key, textX, y2 + 4, anchor, symbol, false, overrideText, mmOnly);
    }

    function defsMarkup(prefix) {
        return '<defs>' +
            '<marker id="' + prefix + 'Arrow" markerWidth="8" markerHeight="8" refX="5" refY="4"' +
            ' orient="auto-start-reverse" markerUnits="userSpaceOnUse">' +
            '<path class="fastener-arrow" d="M0 1 L5 4 L0 7"/></marker>' +
            '<pattern id="' + prefix + 'Hatch" width="7" height="7" patternUnits="userSpaceOnUse"' +
            ' patternTransform="rotate(45)">' +
            '<line x1="0" y1="0" x2="0" y2="7" class="fastener-hatch"/></pattern>' +
            '</defs>';
    }

    function centreLine(x1, x2, y) {
        return lineMarkup("fastener-centre", x1, y, x2, y);
    }

    function verticalCentre(x, y1, y2) {
        return lineMarkup("fastener-centre", x, y1, x, y2);
    }

    function noteMarkup(text, x, y, anchor) {
        return '<text class="fastener-note" x="' + coord(x) + '" y="' + coord(y) +
            '" text-anchor="' + (anchor || "start") + '">' + text + '</text>';
    }

    function svgView(prefix, width, height, cssClass, ariaLabel, title, content, extraClass) {
        return '<div class="diagram-view ' + cssClass + '">' +
            '<svg class="fastener-drawing' + (extraClass ? ' ' + extraClass : '') +
            '" viewBox="0 0 ' + width + ' ' + height + '" ' +
            'role="img" aria-label="' + ariaLabel + '">' + defsMarkup(prefix) + content + '</svg>' +
            '<span class="view-title">' + title + '</span></div>';
    }

    function threadTeeth(x1, x2, crestTop, rootTop, rootBottom, crestBottom, targetPitch) {
        var width = x2 - x1;
        var count = Math.max(2, Math.round(width / targetPitch));
        var step = width / count;
        var upper = "M" + coord(x1) + " " + coord(crestTop);
        var lower = "M" + coord(x1) + " " + coord(crestBottom);

        for (var i = 0; i < count; i += 1) {
            var x0 = x1 + i * step;
            var xm = x0 + step / 2;
            var xe = x0 + step;
            upper += " L" + coord(xm) + " " + coord(rootTop) +
                " L" + coord(xe) + " " + coord(crestTop);
            lower += " L" + coord(xm) + " " + coord(rootBottom) +
                " L" + coord(xe) + " " + coord(crestBottom);
        }

        return pathMarkup("fastener-thread-line", upper) +
            pathMarkup("fastener-thread-line", lower);
    }

    function threadBand(x1, x2, axisY, shankH, pitch, scale, zoom) {
        if (x2 - x1 < 2 || shankH <= 0) {
            return "";
        }

        var crestTop = axisY - shankH / 2;
        var crestBottom = axisY + shankH / 2;
        var rootTop = crestTop + shankH * 0.22;
        var rootBottom = crestBottom - shankH * 0.22;
        var spacing = clamp(fieldMM("pitch", pitch) * scale * (zoom || 1), 7, 24);

        return lineMarkup("fastener-hidden", x1, rootTop, x2, rootTop) +
            lineMarkup("fastener-hidden", x1, rootBottom, x2, rootBottom) +
            threadTeeth(x1, x2, crestTop, rootTop, rootBottom, crestBottom, spacing);
    }

    function sideSvg(product) {
        var diameter = fieldMM("diameter", 10);
        var s = fieldMM("acrossFlats", diameter * 1.6);
        var dk = fieldMM("headDiameter", s);
        var length = fieldMM("length", 50);
        var headHeight = fieldMM("headHeight", diameter * 0.7);
        var isStud = product.category === "studs";
        var isCountersunk = product.drawing === "countersunk";
        var isCarriage = product.drawing === "carriage";
        var isHex = product.drawing === "hex" || product.drawing === "blank";
        var headAcross = isHex ? s : dk;
        var maxAcross = Math.max(diameter, headAcross);
        var scale = Math.min(460 / length, 100 / maxAcross);

        if (!isFinite(scale) || scale <= 0) {
            scale = 1;
        }

        var axisY = 210;
        var shankH = Math.max(14, diameter * scale);
        var top = axisY - shankH / 2;
        var bottom = axisY + shankH / 2;
        var headLen = Math.max(18, headHeight * scale);
        var headH = Math.max(22, headAcross * scale);
        var headLeft = 90;
        var startX = isStud ? headLeft : headLeft + headLen;
        var endX = startX + length * scale;
        var headTop = axisY - headH / 2;
        var headBottom = axisY + headH / 2;
        var arrow = "sideArrow";
        var body = centreLine(headLeft - 16, endX + 34, axisY);
        var shankStart = startX;
        var noThread = product.drawing === "blank";
        var socketEnd = headLeft + clamp(fieldMM("socketDepth", headHeight * 0.6) * scale,
            4, Math.max(5, headLen - 4));

        if (isHex) {
            var chamfer = Math.min(headLen * 0.28, headH * 0.12);

            body += pathMarkup("fastener-part",
                "M" + coord(headLeft + chamfer) + " " + coord(headTop) +
                " L" + coord(startX) + " " + coord(headTop) +
                " L" + coord(startX) + " " + coord(headBottom) +
                " L" + coord(headLeft + chamfer) + " " + coord(headBottom) +
                " L" + coord(headLeft) + " " + coord(headBottom - chamfer) +
                " L" + coord(headLeft) + " " + coord(headTop + chamfer) + " Z");
            body += lineMarkup("fastener-hatch", headLeft + chamfer, headTop + 5,
                startX - 3, headTop + 5);
        } else if (product.drawing === "socket") {
            var socketHalfSide = fieldMM("socketAcrossFlats", s * 0.6) * scale / 2;

            body += '<rect class="fastener-part" x="' + coord(headLeft) +
                '" y="' + coord(headTop) + '" width="' + coord(headLen) +
                '" height="' + coord(headH) + '"/>';
            body += lineMarkup("fastener-hidden", headLeft + 4, axisY - socketHalfSide,
                socketEnd, axisY - socketHalfSide);
            body += lineMarkup("fastener-hidden", headLeft + 4, axisY + socketHalfSide,
                socketEnd, axisY + socketHalfSide);
            body += lineMarkup("fastener-hidden", socketEnd, axisY - socketHalfSide,
                socketEnd, axisY + socketHalfSide);
        } else if (isCountersunk) {
            var cskSocketHalf = fieldMM("socketAcrossFlats", s * 0.6) * scale / 2;

            body += pathMarkup("fastener-part",
                "M" + coord(headLeft) + " " + coord(headTop) +
                " L" + coord(startX) + " " + coord(top) +
                " L" + coord(startX) + " " + coord(bottom) +
                " L" + coord(headLeft) + " " + coord(headBottom) + " Z");
            body += lineMarkup("fastener-hidden", headLeft + 3, axisY - cskSocketHalf,
                socketEnd, axisY - cskSocketHalf);
            body += lineMarkup("fastener-hidden", headLeft + 3, axisY + cskSocketHalf,
                socketEnd, axisY + cskSocketHalf);
            body += lineMarkup("fastener-hidden", socketEnd, axisY - cskSocketHalf,
                socketEnd, axisY + cskSocketHalf);
        } else if (isCarriage) {
            var neckPx = clamp(fieldMM("neckHeight", diameter) * scale, 6, 46);

            body += pathMarkup("fastener-part",
                "M" + coord(headLeft) + " " + coord(axisY) +
                " C" + coord(headLeft) + " " + coord(headTop) +
                " " + coord(startX - headLen * 0.25) + " " + coord(headTop) +
                " " + coord(startX) + " " + coord(headTop) +
                " L" + coord(startX) + " " + coord(headBottom) +
                " C" + coord(startX - headLen * 0.25) + " " + coord(headBottom) +
                " " + coord(headLeft) + " " + coord(headBottom) +
                " " + coord(headLeft) + " " + coord(axisY) + " Z");
            body += '<rect class="fastener-part" x="' + coord(startX) +
                '" y="' + coord(axisY - shankH * 0.7) + '" width="' + coord(neckPx) +
                '" height="' + coord(shankH * 1.4) + '"/>';
            shankStart = startX + neckPx;
        }

        body += '<rect class="fastener-part" x="' + coord(shankStart) +
            '" y="' + coord(top) + '" width="' + coord(endX - shankStart) +
            '" height="' + coord(shankH) + '"/>';

        var threadMM = noThread ? 0 :
            (product.fields.indexOf("threadLength") >= 0 ? fieldMM("threadLength", length) : length);
        var fullThread = product.key === "hex-ft" || product.key === "stud-ft" ||
            product.key === "threaded-rod";
        var threadStart = Math.max(shankStart, endX - Math.min(threadMM, length) * scale);
        var threadPx = fieldMM("pitch", 1.5) * scale;

        if (product.drawing === "stud-de") {
            var leftPx = Math.min(fieldMM("threadLength", length * 0.2), length) * scale;
            var rightPx = Math.min(fieldMM("threadLength2", length * 0.3), length) * scale;
            var leftEnd = Math.min(startX + leftPx, endX);
            var rightStart = Math.max(startX, endX - rightPx);

            body += threadBand(startX, leftEnd, axisY, shankH, threadPx, 1, 1);
            body += threadBand(rightStart, endX, axisY, shankH, threadPx, 1, 1);
            body += dimH(startX, leftEnd, 96, "threadLength",
                { fromY: [top, top], arrow: arrow, symbol: "b1" });
            body += dimH(rightStart, endX, 96, "threadLength2",
                { fromY: [top, top], arrow: arrow, symbol: "b2" });
        } else if (threadMM > 0) {
            body += threadBand(fullThread ? shankStart : threadStart, endX,
                axisY, shankH, threadPx, 1, 1);

            if (!fullThread) {
                body += dimH(threadStart, endX, 312, "threadLength",
                    { fromY: [bottom, bottom], arrow: arrow });
            }
        }

        body += lineMarkup("fastener-part", endX, top, endX - 3, top + 3);
        body += lineMarkup("fastener-part", endX, bottom, endX - 3, bottom - 3);

        if (!isStud) {
            var widthKey = isHex ? "acrossFlats" : "headDiameter";

            body += dimV(headTop, headBottom, headLeft - 42, widthKey,
                { fromX: [headLeft + 4, headLeft + 4], side: "left", arrow: arrow });
            body += dimH(headLeft, startX, 90, "headHeight",
                { fromY: [headTop, headTop], arrow: arrow });
        }

        if (isCarriage) {
            body += dimH(startX, shankStart, 290, "neckHeight",
                { fromY: [bottom, bottom], arrow: arrow });
            body += dimH(startX, shankStart, 330, "neckAcrossFlats",
                { fromY: [bottom, bottom], arrow: arrow });
        }

        var lengthStart = isCountersunk ? headLeft : startX;

        body += dimH(lengthStart, endX, 365, "length",
            { fromY: [bottom, bottom], arrow: arrow });
        body += dimV(top, bottom, endX + 42, "diameter",
            { fromX: [endX, endX], side: "right", arrow: arrow });

        if (threadMM > 0) {
            var leaderX = Math.max(shankStart + 20,
                (Math.max(shankStart, threadStart) + endX) / 2);

            body += leaderMarkup(leaderX, top, Math.min(endX - 30, leaderX + 60), 142,
                "pitch", "P");
        }

        body += noteMarkup(currentStandard().name, 80, 36, "start");
        body += noteMarkup(fullThread ? "FULL LENGTH THREAD" :
            (noThread ? "NO THREAD" : "PARTIAL THREAD"), endX, 36, "end");

        return svgView("side", 720, 430, "view-side",
            product.name + " side elevation with dimension labels", "SIDE ELEVATION", body);
    }

    function hexagonPoints(cx, cy, radius, rotationDeg) {
        var points = [];
        var rotation = rotationDeg || 0;

        for (var corner = 0; corner < 6; corner += 1) {
            var angle = (Math.PI / 180) * (60 * corner + rotation);

            points.push(
                (cx + radius * Math.cos(angle)).toFixed(1) + "," +
                (cy + radius * Math.sin(angle)).toFixed(1)
            );
        }

        return points.join(" ");
    }

    /* Dedicated full-thread hex bolt drawing: two orthographic views only,
       monochrome AutoCAD-style linework, and D/P/L/S/K in millimetres. */
    function hexFullSideSvg(product) {
        var prefix = "hexFullSide";
        var arrow = prefix + "Arrow";
        var d = fieldMM("diameter", 10);
        var s = fieldMM("acrossFlats", d * 1.6);
        var length = fieldMM("length", 50);
        var k = fieldMM("headHeight", d * 0.7);
        var pitch = fieldMM("pitch", 1.5);
        var maxAcross = Math.max(d, s);
        var scale = Math.min(460 / length, 100 / maxAcross);

        if (!isFinite(scale) || scale <= 0) {
            scale = 1;
        }

        var axisY = 210;
        var shankH = Math.max(14, d * scale);
        var top = axisY - shankH / 2;
        var bottom = axisY + shankH / 2;
        var headLen = Math.max(18, k * scale);
        var headH = Math.max(22, s * scale);
        var headLeft = 90;
        var startX = headLeft + headLen;
        var endX = startX + length * scale;
        var headTop = axisY - headH / 2;
        var headBottom = axisY + headH / 2;
        var chamfer = Math.min(headLen * 0.28, headH * 0.12);
        var body = "";

        body += centreLine(headLeft - 16, endX + 34, axisY);
        body += pathMarkup("fastener-part",
            "M" + coord(headLeft + chamfer) + " " + coord(headTop) +
            " L" + coord(startX) + " " + coord(headTop) +
            " L" + coord(startX) + " " + coord(headBottom) +
            " L" + coord(headLeft + chamfer) + " " + coord(headBottom) +
            " L" + coord(headLeft) + " " + coord(headBottom - chamfer) +
            " L" + coord(headLeft) + " " + coord(headTop + chamfer) + " Z");
        body += lineMarkup("fastener-hatch", headLeft + chamfer, headTop + 5,
            startX - 3, headTop + 5);
        body += '<rect class="fastener-part" x="' + coord(startX) +
            '" y="' + coord(top) + '" width="' + coord(endX - startX) +
            '" height="' + coord(shankH) + '"/>';
        body += threadBand(startX, endX, axisY, shankH, pitch, scale, 1);
        body += lineMarkup("fastener-part", endX, top, endX - 3, top + 3);
        body += lineMarkup("fastener-part", endX, bottom, endX - 3, bottom - 3);

        body += dimH(headLeft, startX, 90, "headHeight",
            { fromY: [headTop, headTop], arrow: arrow, symbol: "K", mmOnly: true });
        body += dimH(startX, endX, 365, "length",
            { fromY: [bottom, bottom], arrow: arrow, symbol: "L", mmOnly: true });
        body += dimV(top, bottom, endX + 42, "diameter",
            { fromX: [endX, endX], side: "right", arrow: arrow, symbol: "D", mmOnly: true });

        /* One pitch is bracketed between adjacent crests, then called out by
           leader so P is shown once without duplicating the symbol. */
        var toothCount = Math.max(2,
            Math.round((endX - startX) / clamp(pitch * scale, 7, 24)));
        var toothStep = (endX - startX) / toothCount;
        var pitchX1 = startX + toothStep * Math.min(2, toothCount - 1);
        var pitchX2 = pitchX1 + toothStep;
        var pitchY = top - 18;
        var pitchFromX = (pitchX1 + pitchX2) / 2;
        var leaderTargetX = Math.min(endX - 40, pitchX2 + 70);
        var leaderAnchor = leaderTargetX >= pitchFromX ? "start" : "end";
        var leaderTextX = leaderTargetX + (leaderAnchor === "start" ? 7 : -7);

        body += circleMarkup("fastener-point", pitchX1, top, 2.4);
        body += lineMarkup("fastener-ext", pitchX1, top, pitchX1, pitchY - 4);
        body += lineMarkup("fastener-ext", pitchX2, top, pitchX2, pitchY - 4);
        body += lineMarkup("fastener-dim", pitchX1, pitchY, pitchX2, pitchY,
            ' marker-start="url(#' + arrow + ')" marker-end="url(#' + arrow + ')"');
        body += lineMarkup("fastener-ext", pitchFromX, pitchY, leaderTargetX, 125);
        body += labelMarkup("pitch", leaderTextX, 129, leaderAnchor, "P", false, null, true);

        return svgView(prefix, 720, 430, "view-side",
            product.name + " side elevation with full-length thread and D, P, L, K dimensions",
            "SIDE ELEVATION", body, "fastener-drawing--mono");
    }

    function hexFullEndSvg() {
        var prefix = "hexFullEnd";
        var arrow = prefix + "Arrow";
        var s = fieldMM("acrossFlats", 16);
        var d = fieldMM("diameter", 10);
        var radiusMM = s / Math.sqrt(3);
        var scale = 100 / radiusMM;
        var cx = 180;
        var cy = 170;
        var R = 100;
        var flatHalf = R * Math.sqrt(3) / 2;
        var bodyR = clamp(d * scale / 2, 12, flatHalf - 8);
        var body = "";

        body += polygonMarkup("fastener-part", hexagonPoints(cx, cy, R, 30));
        body += circleMarkup("fastener-part", cx, cy, bodyR);
        body += centreLine(40, 320, cy);
        body += verticalCentre(cx, 38, 300);
        body += dimH(cx - flatHalf, cx + flatHalf, 315, "acrossFlats", {
            fromY: [cy + R / 2, cy + R / 2],
            arrow: arrow,
            symbol: "S",
            mmOnly: true,
            labelBelow: true
        });

        return svgView(prefix, 360, 370, "view-end",
            "Full-thread hex bolt end view: across flats S and concentric bolt body diameter",
            "END VIEW", body, "fastener-drawing--mono");
    }

    function hexEndSvg(product) {
        var prefix = "hexEnd";
        var arrow = prefix + "Arrow";
        var isNut = product.category === "nuts";
        var s = fieldMM("acrossFlats", 16);
        var radiusMM = s / Math.sqrt(3);
        var scale = 100 / radiusMM;
        var cx = 180;
        var cy = 190;
        var R = 100;
        var flatHalf = R * Math.sqrt(3) / 2;
        var body = defsMarkup(prefix);

        body += polygonMarkup("fastener-part", hexagonPoints(cx, cy, R));
        body += centreLine(40, 320, cy);
        body += verticalCentre(cx, 60, 322);

        if (isNut) {
            var d = fieldMM("diameter", 10);
            var boreR = clamp(d * scale / 2, 18, 70);

            body += circleMarkup("fastener-part", cx, cy, boreR);
            body += circleMarkup("fastener-hidden", cx, cy, boreR * 0.86);
            body += leaderMarkup(cx + boreR, cy - 8, cx + boreR + 42, 92, "diameter", "d");
            body += leaderMarkup(cx + boreR * 0.7, cy + boreR * 0.7,
                cx + boreR + 42, 120, "pitch", "P");
        }

        body += dimH(cx - R, cx + R, 58, "acrossCorners",
            { fromY: [cy, cy], arrow: arrow });
        body += dimV(cy - flatHalf, cy + flatHalf, cx + R + 46, "acrossFlats",
            { fromX: [cx, cx], side: "right", arrow: arrow });
        body += noteMarkup(isNut ? "TOP VIEW - HEX NUT" : "HEAD END VIEW", cx, 356, "middle");

        return svgView(prefix, 360, 380, "view-end",
            (isNut ? "Nut" : "Bolt head") + " end view, across flats s and across corners e",
            "END VIEW", body);
    }

    function nutSectionSvg() {
        var prefix = "nutSection";
        var arrow = prefix + "Arrow";
        var s = fieldMM("acrossFlats", 16);
        var m = fieldMM("nutHeight", 8.4);
        var d = fieldMM("diameter", 10);
        var scale = 100 / s;
        var thickPx = clamp(m * scale, 58, 112);
        var outerHPx = clamp(s * scale, 108, 150);
        var holeHalf = clamp(d * scale / 2, 16, 42);
        var cx = 210;
        var cy = 180;
        var left = cx - thickPx / 2;
        var right = cx + thickPx / 2;
        var top = cy - outerHPx / 2;
        var bottom = cy + outerHPx / 2;
        var holeTop = cy - holeHalf;
        var holeBottom = cy + holeHalf;
        var chamfer = Math.min(thickPx * 0.25, outerHPx * 0.12);
        var body = defsMarkup(prefix);

        body += pathMarkup("fastener-section",
            "M" + coord(left + chamfer) + " " + coord(top) +
            " L" + coord(right - chamfer) + " " + coord(top) +
            " L" + coord(right) + " " + coord(top + chamfer) +
            " L" + coord(right) + " " + coord(holeTop) +
            " L" + coord(left) + " " + coord(holeTop) +
            " L" + coord(left) + " " + coord(top + chamfer) + " Z",
            ' fill="url(#' + prefix + 'Hatch)"');
        body += pathMarkup("fastener-section",
            "M" + coord(left) + " " + coord(holeBottom) +
            " L" + coord(right) + " " + coord(holeBottom) +
            " L" + coord(right) + " " + coord(bottom - chamfer) +
            " L" + coord(right - chamfer) + " " + coord(bottom) +
            " L" + coord(left + chamfer) + " " + coord(bottom) +
            " L" + coord(left) + " " + coord(bottom - chamfer) + " Z",
            ' fill="url(#' + prefix + 'Hatch)"');
        body += lineMarkup("fastener-part", left, holeTop, right, holeTop);
        body += lineMarkup("fastener-part", left, holeBottom, right, holeBottom);
        body += lineMarkup("fastener-hidden", left + 3, holeTop + 4, right - 3, holeTop + 4);
        body += lineMarkup("fastener-hidden", left + 3, holeBottom - 4, right - 3, holeBottom - 4);
        body += centreLine(left - 20, right + 20, cy);

        body += dimH(left, right, 64, "nutHeight", { fromY: [top, top], arrow: arrow });
        body += dimV(top, bottom, right + 58, "acrossFlats",
            { fromX: [right, right], side: "right", arrow: arrow });
        body += dimV(holeTop, holeBottom, left - 58, "diameter",
            { fromX: [left, left], side: "left", arrow: arrow });
        body += leaderMarkup(cx, holeTop + 4, cx + 74, 96, "pitch", "P");
        body += noteMarkup("SECTION - THROUGH THREAD", cx, 326, "middle");

        return svgView(prefix, 520, 350, "view-section",
            "Nut sectional side view showing height m, thread d and hatched material",
            "SECTIONAL SIDE VIEW", body);
    }

    function threadDetailSvg(product) {
        var prefix = "threadDetail";
        var arrow = prefix + "Arrow";
        var p = fieldMM("pitch", 1.5);
        var d = fieldMM("diameter", 10);
        var spacing = clamp(p * 9, 18, 42);
        var rootDepth = spacing * 0.22;
        var x1 = 52;
        var x2 = 408;
        var crestTop = 96;
        var crestBottom = 188;
        var axisY = (crestTop + crestBottom) / 2;
        var body = defsMarkup(prefix);

        body += centreLine(24, 444, axisY);
        body += threadTeeth(x1, x2, crestTop, crestTop + rootDepth,
            crestBottom - rootDepth, crestBottom, spacing);
        body += lineMarkup("fastener-hidden", x1, crestTop + rootDepth, x2, crestTop + rootDepth);
        body += lineMarkup("fastener-hidden", x1, crestBottom - rootDepth, x2, crestBottom - rootDepth);
        body += dimH(x1, x1 + spacing, 56, "pitch",
            { fromY: [crestTop, crestTop], arrow: arrow });
        body += dimV(crestTop, crestBottom, 452, "diameter",
            { fromX: [x2, x2], side: "right", arrow: arrow });
        body += noteMarkup("ENLARGED THREAD PROFILE", 232, 232, "middle");

        return svgView(prefix, 480, 260, "view-detail",
            product.name + " enlarged thread profile showing pitch P and diameter d",
            "THREAD DETAIL", body);
    }

    function studEndSvg() {
        var prefix = "studEnd";
        var arrow = prefix + "Arrow";
        var d = fieldMM("diameter", 12);
        var cx = 128;
        var cy = 128;
        var R = 70;
        var body = defsMarkup(prefix);

        body += circleMarkup("fastener-part", cx, cy, R);
        body += centreLine(28, 228, cy);
        body += verticalCentre(cx, 28, 228);
        body += dimV(cy - R, cy + R, cx + R + 46, "diameter",
            { fromX: [cx + R, cx + R], side: "right", arrow: arrow });
        body += noteMarkup("STUD END VIEW", cx, 238, "middle");

        return svgView(prefix, 260, 260, "view-end",
            "Stud end view showing nominal diameter d", "END VIEW", body);
    }

    function countersunkTopSvg(product) {
        var prefix = "cskTop";
        var arrow = prefix + "Arrow";
        var dk = fieldMM("headDiameter", 16);
        var d = fieldMM("diameter", 10);
        var s = fieldMM("socketAcrossFlats", 6);
        var scale = 90 / (dk / 2);
        var cx = 150;
        var cy = 150;
        var outerR = 90;
        var boreR = clamp(d * scale / 2, 12, 74);
        var socketR = s * scale / Math.sqrt(3);
        var body = defsMarkup(prefix);

        body += circleMarkup("fastener-part", cx, cy, outerR);
        body += circleMarkup("fastener-hidden", cx, cy, boreR);
        body += polygonMarkup("fastener-part", hexagonPoints(cx, cy, socketR));
        body += centreLine(28, 272, cy);
        body += verticalCentre(cx, 28, 272);
        body += dimV(cy - outerR, cy + outerR, cx + outerR + 44, "headDiameter",
            { fromX: [cx + outerR, cx + outerR], side: "right", arrow: arrow });
        body += leaderMarkup(cx + socketR, cy - 6, cx + outerR + 44, 82,
            "socketAcrossFlats", "s");
        body += noteMarkup("TOP VIEW - HEX SOCKET", cx, 278, "middle");

        return svgView(prefix, 320, 300, "view-end",
            product.name + " top view showing head diameter dk and socket s",
            "TOP VIEW", body);
    }

    function countersunkSectionSvg() {
        var prefix = "cskSection";
        var arrow = prefix + "Arrow";
        var d = fieldMM("diameter", 10);
        var dk = fieldMM("headDiameter", 16);
        var s = fieldMM("socketAcrossFlats", 6);
        var t = fieldMM("socketDepth", 4);
        var scale = 150 / dk;
        var outerHalf = 75;
        var shankHalf = clamp(d * scale / 2, 12, 60);
        var kPx = Math.max(8, (dk - d) * scale / 2);
        var tPx = clamp(t * scale, 6, kPx + 40);
        var socketHalf = clamp(s * scale / 2, 8, outerHalf * 0.55);
        var x0 = 96;
        var x1 = x0 + kPx;
        var x2 = x1 + 150;
        var cy = 170;
        var body = defsMarkup(prefix);

        body += centreLine(x0 - 20, x2 + 24, cy);
        body += pathMarkup("fastener-section",
            "M" + coord(x0) + " " + coord(cy - outerHalf) +
            " L" + coord(x1) + " " + coord(cy - shankHalf) +
            " L" + coord(x2) + " " + coord(cy - shankHalf) +
            " L" + coord(x2) + " " + coord(cy + shankHalf) +
            " L" + coord(x1) + " " + coord(cy + shankHalf) +
            " L" + coord(x0) + " " + coord(cy + outerHalf) + " Z",
            ' fill="url(#' + prefix + 'Hatch)"');
        body += '<rect x="' + coord(x0) + '" y="' + coord(cy - socketHalf) +
            '" width="' + coord(tPx) + '" height="' + coord(socketHalf * 2) +
            '" fill="#ffffff" stroke="none"/>';
        body += lineMarkup("fastener-part", x0, cy - outerHalf, x0, cy - socketHalf);
        body += lineMarkup("fastener-part", x0, cy + socketHalf, x0, cy + outerHalf);
        body += lineMarkup("fastener-hidden", x0 + 3, cy - socketHalf, x0 + tPx, cy - socketHalf);
        body += lineMarkup("fastener-hidden", x0 + 3, cy + socketHalf, x0 + tPx, cy + socketHalf);
        body += lineMarkup("fastener-hidden", x0 + tPx, cy - socketHalf, x0 + tPx, cy + socketHalf);
        body += lineMarkup("fastener-part", x1, cy - shankHalf, x2, cy - shankHalf);
        body += lineMarkup("fastener-part", x1, cy + shankHalf, x2, cy + shankHalf);

        body += dimV(cy - outerHalf, cy + outerHalf, x0 - 44, "headDiameter",
            { fromX: [x0, x0], side: "left", arrow: arrow });
        body += dimH(x0, x1, 70, "headHeight",
            { fromY: [cy - outerHalf, cy - outerHalf], arrow: arrow });
        body += dimV(cy - socketHalf, cy + socketHalf, x0 + tPx + 32, "socketAcrossFlats",
            { fromX: [x0 + tPx, x0 + tPx], side: "right", arrow: arrow });
        body += dimH(x0, x0 + tPx, 258, "socketDepth",
            { fromY: [cy + socketHalf, cy + socketHalf], arrow: arrow });
        body += dimV(cy - shankHalf, cy + shankHalf, x2 + 44, "diameter",
            { fromX: [x2, x2], side: "right", arrow: arrow });
        body += noteMarkup("90° COUNTERSINK", (x0 + x1) / 2, 112, "middle");

        return svgView(prefix, 460, 290, "view-section",
            "Countersunk screw sectional side view with 90 degree head, socket depth t and diameter d",
            "SECTIONAL SIDE VIEW", body);
    }

    function socketTopSvg(product) {
        var prefix = "socketTop";
        var arrow = prefix + "Arrow";
        var dk = fieldMM("headDiameter", 16);
        var s = fieldMM("socketAcrossFlats", 6);
        var scale = 90 / (dk / 2);
        var cx = 150;
        var cy = 150;
        var outerR = 90;
        var socketR = s * scale / Math.sqrt(3);
        var body = defsMarkup(prefix);

        body += circleMarkup("fastener-part", cx, cy, outerR);
        body += polygonMarkup("fastener-part", hexagonPoints(cx, cy, socketR));
        body += centreLine(28, 272, cy);
        body += verticalCentre(cx, 28, 272);
        body += dimV(cy - outerR, cy + outerR, cx + outerR + 44, "headDiameter",
            { fromX: [cx + outerR, cx + outerR], side: "right", arrow: arrow });
        body += leaderMarkup(cx + socketR, cy - 6, cx + outerR + 44, 82,
            "socketAcrossFlats", "s");
        body += noteMarkup("TOP VIEW - HEX SOCKET", cx, 278, "middle");

        return svgView(prefix, 320, 300, "view-end",
            product.name + " top view showing head diameter dk and socket s",
            "TOP VIEW", body);
    }

    function renderDrawing() {
        var product = currentProduct();
        var views = [];
        var caption = "";

        if (product.key === "hex-ft") {
            views = [hexFullEndSvg(), hexFullSideSvg(product)];
            caption = product.name + " — end view and full-thread side elevation";
        } else if (product.category === "nuts") {
            views = [hexEndSvg(product), nutSectionSvg()];
            caption = product.name + " — top hex and sectional side views";
        } else if (product.drawing === "hex" || product.drawing === "blank") {
            views = [sideSvg(product), hexEndSvg(product), threadDetailSvg(product)];
            caption = product.name + " — side, head end and thread detail";
        } else if (product.category === "studs") {
            views = [sideSvg(product), studEndSvg(), threadDetailSvg(product)];
            caption = product.name + " — side, end and thread detail";
        } else if (product.drawing === "countersunk") {
            views = [sideSvg(product), countersunkTopSvg(product), countersunkSectionSvg()];
            caption = product.name + " — side, top and sectional side views";
        } else if (product.drawing === "socket") {
            views = [sideSvg(product), socketTopSvg(product), threadDetailSvg(product)];
            caption = product.name + " — side, top and thread detail";
        } else {
            views = [sideSvg(product), threadDetailSvg(product)];
            caption = product.name + " — side and thread detail";
        }

        diagramViews.className = "diagram-views diagram-views-multi";
        diagramViews.setAttribute("aria-label", caption);
        diagramViews.innerHTML = views.join("");
        drawingCaption.textContent = caption;
    }

    function updateDrawingLabels() {
        diagramViews.querySelectorAll("[data-dim]").forEach(function (node) {
            var key = node.getAttribute("data-dim");
            var symbol = node.getAttribute("data-symbol") || null;
            var mmOnly = node.getAttribute("data-unit-mode") === "mm";

            node.textContent = mmOnly ? dimTextMM(key, symbol) : dimText(key, symbol);
        });
    }

    /* ==================================================
       NOTES UNDER THE SELECTIONS
    ================================================== */
    function refreshNotes() {
        var product = currentProduct();
        var standard = currentStandard();

        if (!standard.sizes.length) {
            standardNote.textContent = "Custom dimensions: type every dimension yourself. " +
                "The drawing and the calculation update with your values.";
        } else {
            standardNote.textContent = standard.name +
                " size table. Choosing a size fills in its standard dimensions; " +
                "every filled value can still be edited.";
        }

        var notes = [];

        if (product.key === "hex-ft") {
            notes.push("A fully threaded bolt carries thread over its whole length, " +
                "so no separate thread length is needed.");
        }

        if (product.key === "hex-ht") {
            notes.push("The thread length follows " + standard.name +
                " for the selected length. You can type your own value.");
        }

        if (product.key === "socket-head" || product.key === "countersunk") {
            notes.push("Thread length follows the selected standard; " +
                "edit it if your part has a different threaded length.");
        }

        if (product.key === "carriage") {
            notes.push("Carriage bolt length is measured under the head to the end of the shank.");
        }

        if (product.key === "stud-de") {
            notes.push("Double end studs have thread at both ends and a plain shank in the middle. " +
                "DIN 938 defaults are 1d at the metal end and the standard thread length at the nut end.");
        }

        if (product.key === "lock-nut") {
            notes.push("The nylon collar of a lock nut is not metal; " +
                NYLON_INSERT_MM + " mm of its height is left out of the weight.");
        }

        if (product.category === "nuts") {
            notes.push("The bore is the average of the major and minor thread areas, " +
                "so the thread is counted once, not as a plain hole.");
        }

        dimensionNote.textContent = notes.join(" ");
    }

    /* ==================================================
       DENSITY DISPLAY
    ================================================== */
    function selectedMaterial() {
        return MATERIALS[materialSelect.value] || null;
    }

    function currentDensity() {
        if (materialSelect.value === "custom") {
            return Number(customDensity.value);
        }

        var material = selectedMaterial();

        return material ? material.density : NaN;
    }

    function updateDensityDisplay() {
        if (materialSelect.value === "custom") {
            customDensityBox.classList.add("visible");
            var value = Number(customDensity.value);

            densityInfo.textContent = isFinite(value) && value > 0
                ? "Custom — " + formatNumber(value, 2) + " g/cm³"
                : "Custom — enter a density";
            return;
        }

        customDensityBox.classList.remove("visible");
        var material = selectedMaterial();

        densityInfo.textContent = material
            ? material.name + " — " + formatNumber(material.density, 2) + " g/cm³"
            : "Enter a custom density";
    }

    /* ==================================================
       VALIDATION
    ================================================== */
    function readRequired(key, allowZero) {
        var input = fieldInput(key);
        var field = FIELD_DEFS[key];
        var raw = input.value.trim();

        if (raw === "") {
            showError(field.label + " is required. Please enter a value.", input);
            return null;
        }

        var value = Number(raw);

        if (!isFinite(value)) {
            showError(field.label + " must be a number.", input);
            return null;
        }

        if (value < 0 || (!allowZero && value === 0)) {
            showError(field.label + (allowZero
                ? " must be zero or greater."
                : " must be greater than zero."), input);
            return null;
        }

        return value;
    }

    function collectForm() {
        clearError();
        clearInvalid();

        var product = currentProduct();
        var values = {};
        var failed = false;
        var zeroThreadAllowed = ["carriage", "socket-head", "countersunk"]
            .indexOf(state.productKey) !== -1;

        product.fields.forEach(function (key) {
            if (failed) {
                return;
            }

            var value = readRequired(
                key,
                zeroThreadAllowed && key === "threadLength"
            );

            if (value === null) {
                failed = true;
                return;
            }

            values[key] = value;
        });

        if (failed) {
            return null;
        }

        var quantityValue = Number(quantity.value);

        if (!isFinite(quantityValue) || !Number.isInteger(quantityValue) ||
            quantityValue < 1) {
            showError("Quantity must be a positive whole number.", quantity);
            return null;
        }

        if (quantityValue > 1000000) {
            showError("Quantity is too large. Enter 1,000,000 or less.", quantity);
            return null;
        }

        if (values.length !== undefined && values.threadLength !== undefined) {
            if (values.threadLength > values.length) {
                showError("Thread length cannot be longer than the overall length.",
                    fieldInput("threadLength"));
                return null;
            }
        }

        if (values.threadLength2 !== undefined && values.length !== undefined) {
            if (values.threadLength + values.threadLength2 > values.length) {
                showError("The two thread lengths together are longer than the stud.",
                    fieldInput("threadLength2"));
                return null;
            }
        }

        if (values.acrossFlats !== undefined && values.diameter !== undefined &&
            values.nutHeight !== undefined && values.acrossFlats <= values.diameter) {
            showError("Width across flats must be larger than the nominal diameter.",
                fieldInput("acrossFlats"));
            return null;
        }

        if (product.key === "lock-nut" && values.nutHeight <= NYLON_INSERT_MM) {
            showError("Nut height is too small for a nylon insert lock nut.",
                fieldInput("nutHeight"));
            return null;
        }

        if (values.headDiameter !== undefined && values.diameter !== undefined &&
            values.headDiameter <= values.diameter) {
            showError("Head diameter must be larger than the shank diameter.",
                fieldInput("headDiameter"));
            return null;
        }

        if (values.socketAcrossFlats !== undefined) {
            if (values.socketAcrossFlats >= values.headDiameter) {
                showError("The socket must be smaller than the head diameter.",
                    fieldInput("socketAcrossFlats"));
                return null;
            }

            if (values.socketDepth >= values.headHeight) {
                showError("The socket depth must be smaller than the head height.",
                    fieldInput("socketDepth"));
                return null;
            }
        }

        if (values.neckAcrossFlats !== undefined &&
            values.neckAcrossFlats <= values.diameter) {
            showError("The square neck must be larger than the shank diameter.",
                fieldInput("neckAcrossFlats"));
            return null;
        }

        var density = currentDensity();

        if (materialSelect.value === "custom" &&
            (!isFinite(density) || density <= 0)) {
            showError("Enter a custom density greater than zero.", customDensity);
            return null;
        }

        return {
            values: values,
            quantity: quantityValue,
            density: density,
            factor: mmFactor()
        };
    }

    /* ==================================================
       RESULTS
    ================================================== */
    /* One short line for the history table: standard, size and length. */
    function itemDetail(form) {
        var standard = currentStandard();
        var parts = [standard.name.replace(/\s*\(.*\)$/, "")];

        if (state.sizeLabel) {
            parts.push(state.sizeLabel);
        }

        if (form.values.length !== undefined) {
            parts.push("L " + formatDimension(form.values.length * form.factor));
        }

        return parts.join(" · ");
    }

    function renderResult(result, form) {
        var product = currentProduct();

        results.classList.add("visible");

        $("totalWeight").textContent = formatKg(result.totalWeight);
        $("totalPounds").textContent = formatLbs(result.totalPounds);
        $("unitWeightKg").textContent = formatKg(result.singleWeight);
        $("unitWeightLbs").textContent = formatLbs(result.singlePounds);
        $("resultQuantity").textContent = formatNumber(result.quantity, 0) + " pc";
        $("resultVolume").textContent = formatNumber(result.volumeMM3 / 1000, 2) + " cm³";
        $("resultStressArea").textContent = formatNumber(result.stressAreaMM2, 1) + " mm²";
        $("resultDensity").textContent = formatNumber(result.density, 2) + " g/cm³";

        /* The dimension line lists exactly the values that were calculated. */
        var dimensions = [currentStandard().name];

        product.fields.forEach(function (key) {
            var symbol = key === "threadLength2" ? "b2" : FIELD_DEFS[key].symbol;

            dimensions.push(symbol + " " + formatDimension(form.values[key] * form.factor));
        });

        dimensions.push(result.materialName || "Custom Material");
        dimensions.push("Quantity " + formatNumber(result.quantity, 0));

        $("resultDimensions").textContent = dimensions.join(" · ");

        /* Record for the shared history drawer. Values stay in the unit the
           user entered, with the same unit string the other pages supply. */
        var values = {};
        product.fields.forEach(function (key) {
            values[key] = form.values[key];
        });

        lastCalculation = {
            values: values,
            unit: state.unit,
            density: result.density,
            materialName: result.materialName ||
                (materialSelect.value === "custom" ? "Custom Material" : selectedMaterial().name),
            quantity: result.quantity,
            singleWeight: result.singleWeight,
            totalWeight: result.totalWeight
        };
    }

    /* ==================================================
       CALCULATE
    ================================================== */
    function calculate() {
        if (isCalculating) {
            return;
        }

        /* A failed or changed calculation must never feed the previous result
           into the shared history drawer. */
        lastCalculation = null;

        var form = collectForm();

        if (!form) {
            return;
        }

        var payload = {
            product: state.productKey,
            standard: state.standardId,
            size: state.sizeLabel,
            values: form.values,
            unit: state.unit,
            density: form.density,
            quantity: form.quantity,
            material: materialSelect.value
        };

        isCalculating = true;

        window.MWCalc.calculate("nut-bolt", payload).then(function (result) {
            renderResult(result, form);
        }).catch(function (error) {
            showError(error.message || "The calculation could not be completed.",
                error.field ? fieldInput(error.field) : null);
        }).finally(function () {
            isCalculating = false;
        });
    }

    /* ==================================================
       UNIT SWITCH
    ================================================== */
    function changeUnit(nextUnit) {
        if (nextUnit === state.unit) {
            return;
        }

        /* Switch first, so the values are rounded with the precision of the
           unit they are being converted into. */
        state.unit = nextUnit;
        lastCalculation = null;

        document.querySelectorAll("[data-field]").forEach(function (input) {
            var key = input.dataset.field;
            var mm = state.mmValues[key];

            /* Without a remembered value (for example a hand-edited field that
               was cleared), fall back to the number on screen. */
            if (!isFinite(mm) || mm <= 0) {
                var current = Number(input.value);

                /* The text still belongs to the previous unit. */
                mm = isFinite(current) && current > 0
                    ? current * (nextUnit === "in" ? 1 : INCH)
                    : NaN;
            }

            if (isFinite(mm) && mm > 0) {
                input.value = formatInputNumber(nextUnit === "in" ? mm / INCH : mm);
            }
        });

        updateUnitButtons();
        updateFieldLabels();
        renderDrawing();
        unitNote.textContent = nextUnit === "in"
            ? "All dimensions are in inches."
            : "All dimensions are in millimeters.";
        refreshNotes();
        clearInvalid();
        clearError();
        hideResults();
    }

    /* ==================================================
       RESET
    ================================================== */
    function resetForm() {
        state.unit = "mm";
        state.category = "bolts";
        state.touched = {};
        lastCalculation = null;

        categoryTabs.forEach(function (tab) {
            var active = tab.dataset.category === state.category;

            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
            tab.tabIndex = active ? 0 : -1;
            if (active && dimensionFields) {
                dimensionFields.setAttribute("aria-labelledby", tab.id);
            }
        });

        materialSelect.value = "carbon-steel";
        customDensity.value = "";
        quantity.value = "1";
        unitNote.textContent = "All dimensions are in millimeters.";
        updateDensityDisplay();
        updateUnitButtons();

        populateProductSelect("hex-ft");
        clearResultState();
    }

    /* ==================================================
       EVENTS
    ================================================== */
    function setCategory(category) {
        state.category = category;

        categoryTabs.forEach(function (tab) {
            var active = tab.dataset.category === category;

            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
            tab.tabIndex = active ? 0 : -1;
            if (active && dimensionFields) {
                dimensionFields.setAttribute("aria-labelledby", tab.id);
            }
        });

        populateProductSelect(lastProductByCategory[category]);
    }

    function bindEvents() {
        categoryTabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
                setCategory(tab.dataset.category);
            });

            tab.addEventListener("keydown", function (event) {
                var current = Array.prototype.indexOf.call(categoryTabs, tab);
                var next = current;

                if (event.key === "ArrowLeft") {
                    next = (current - 1 + categoryTabs.length) % categoryTabs.length;
                } else if (event.key === "ArrowRight") {
                    next = (current + 1) % categoryTabs.length;
                } else if (event.key === "Home") {
                    next = 0;
                } else if (event.key === "End") {
                    next = categoryTabs.length - 1;
                } else {
                    return;
                }

                event.preventDefault();
                var nextTab = categoryTabs[next];
                setCategory(nextTab.dataset.category);
                nextTab.focus();
            });
        });

        productSelect.addEventListener("change", function () {
            loadProduct(productSelect.value);
        });

        standardSelect.addEventListener("change", function () {
            state.standardId = standardSelect.value;
            state.sizeLabel = "";
            populateSizes();
            clearResultState();
            refreshNotes();
            renderDrawing();
        });

        sizeSelect.addEventListener("change", function () {
            state.sizeLabel = sizeSelect.value;
            applyPreset(currentSize());
            clearResultState();
            refreshNotes();
        });

        dimensionFields.addEventListener("input", function (event) {
            var input = event.target.closest("[data-field]");

            if (!input) {
                return;
            }

            var key = input.dataset.field;

            /* The input event also fires for a programmatic value in some
               browsers; only a real visit to the field counts as touched. */
            if (event.isTrusted) {
                state.touched[key] = true;
            }

            input.classList.remove("invalid");
            input.removeAttribute("aria-invalid");

            rememberMMValue(key);

            if (key === "length" || key === "diameter") {
                applyThreadLengths();
            }

            /* Geometry follows the typed values; labels follow the active unit. */
            renderDrawing();
        });

        mmBtn.addEventListener("click", function () {
            changeUnit("mm");
        });

        inchBtn.addEventListener("click", function () {
            changeUnit("in");
        });

        materialSelect.addEventListener("change", function () {
            updateDensityDisplay();

            if (materialSelect.value !== "custom") {
                customDensity.value = "";
            }
        });

        customDensity.addEventListener("input", updateDensityDisplay);
        quantity.addEventListener("input", function () {
            quantity.classList.remove("invalid");
            quantity.removeAttribute("aria-invalid");
        });

        calculateBtn.addEventListener("click", calculate);
        resetBtn.addEventListener("click", resetForm);

        var densityToggle = $("fastenerDensityToggle");
        if (densityToggle) {
            densityToggle.addEventListener("click", function () {
                var table = $("fastenerDensityTable");
                var open = densityToggle.getAttribute("aria-expanded") === "true";
                var rows = table ? table.querySelectorAll(".density-extra") : [];

                rows.forEach(function (row) {
                    row.hidden = open;
                });
                densityToggle.setAttribute("aria-expanded", open ? "false" : "true");
                var label = densityToggle.querySelector("span");
                if (label) {
                    label.textContent = open
                        ? "View All Material Densities"
                        : "Show Fewer Material Densities";
                }
            });
        }
    }

    /* ==================================================
       START
    ================================================== */
    function init() {
        bindEvents();
        updateUnitButtons();
        updateDensityDisplay();
        populateProductSelect("hex-ft");
    }

    init();

    /* Shared history configuration. calculation-history.js is loaded after
       this script and uses the same button, drawer and storage as every other
       calculator page. */
    window.CALCULATOR_HISTORY_CONFIG = {
        calculatorName: "Nut & Bolt Weight Calculator",
        historyKey: "nut-bolt",
        shapeName: function () {
            return currentProduct().shortName + " · " +
                currentStandard().name.replace(/\s*\(.*\)$/, "") +
                (state.sizeLabel ? " · " + state.sizeLabel : "");
        },
        sizeLabels: false,
        dimensions: [
            { key: "diameter", label: "Nominal Diameter (d)" },
            { key: "pitch", label: "Thread Pitch (P)" },
            { key: "length", label: "Length (L)" },
            { key: "threadLength", label: "Thread Length (b)" },
            { key: "threadLength2", label: "Second Thread Length (b2)" },
            { key: "acrossFlats", label: "Width Across Flats (s)" },
            { key: "headHeight", label: "Head Height (k)" },
            { key: "headDiameter", label: "Head Diameter (dk)" },
            { key: "socketAcrossFlats", label: "Socket Width (s)" },
            { key: "socketDepth", label: "Socket Depth (t)" },
            { key: "neckAcrossFlats", label: "Square Neck Width (a)" },
            { key: "neckHeight", label: "Neck Height (f)" },
            { key: "nutHeight", label: "Nut Height (m)" }
        ],
        getCalculation: function () {
            return lastCalculation;
        }
    };
})();
/* ==================================================
   NUT AND BOLT WEIGHT CALCULATOR END
================================================== */
