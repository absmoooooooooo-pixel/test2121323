/*
 * Nut, bolt and stud weight calculator.
 *
 * One module for three categories (bolts, studs, nuts) and every product in
 * them. Each product has its own function below, so the head of a hex bolt is
 * never calculated with the formula of a socket screw and a nut is never
 * treated as a solid cylinder.
 *
 * INPUT
 *   product   product key from PRODUCTS, e.g. "hex-ht"
 *   values    the dimension fields that product needs, in the unit on screen
 *   unit      "mm" or "in"
 *   density   g/cm³
 *   quantity  whole number of identical pieces
 *
 * Everything is converted to millimetres and cubic millimetres first, because
 * mixing units is the usual source of wrong fastener weights.
 *
 * WEIGHT
 *   weight (kg) = volume (mm³) × density (g/cm³) / 1,000,000
 *   pounds      = kilograms × 2.2046226218
 *
 * THREADS
 *   A threaded length is not a full cylinder. Its effective area is the
 *   stress area of the selected thread system:
 *
 *       ISO metric (ISO 898-1):  As = π/4 × (d − 0.9382 × P)²
 *       Unified inch (ASME B1.1): As = π/4 × (d − 0.9743 × P)²
 *
 *   The factors are the averages of the minor and pitch diameters of their
 *   60° threads. The metric factor reproduces the published ISO stress areas
 *   exactly (M12 = 84.3 mm², M20 = 245 mm²). ASME inch standards must use the
 *   larger Unified factor or their threaded weight is overstated.
 *
 * HEADS AND NUTS
 *   Each shape is a geometric model based on the standard dimensions that the
 *   page fills in (see the comment above every product function). Chamfers,
 *   radii under the head and thread run-out are not modelled; they are small
 *   and are listed in the "Assumptions" panel of the page.
 */
"use strict";

const {
    readQuantity,
    readDensity,
    assertFinite,
    ValidationError
} = require("../core/validation");
const { weightFromVolume } = require("../core/weight");

const INCH_TO_MM = 25.4;
const LBS_PER_KG = 2.2046226218;

/* Area of a regular hexagon measured across flats: (√3 / 2) × s². */
const HEX_AREA_FACTOR = Math.sqrt(3) / 2;

/* Stress-area diameter factors for 60° threads. */
const ISO_STRESS_DIAMETER_FACTOR = 0.9382;
const UNIFIED_STRESS_DIAMETER_FACTOR = 0.9743;

/* ISO 965-1 internal thread minor diameter: D1 = d − 1.0825 × P. */
const MINOR_DIAMETER_FACTOR = 1.0825;

/* Basic external thread root diameter: d3 = d − 1.226869 × P (60° thread). */
const EXTERNAL_ROOT_DEPTH_FACTOR = 1.226869;

/* Standard hex head/nut chamfer: 30° cone tangent to the across-flats faces. */
const HEX_CHAMFER_ANGLE_RAD = Math.PI / 6;

/* The nylon collar of a lock nut is not metal: take this depth off the nut. */
const NYLON_INSERT_DEPTH_MM = 1.5;

/* ---------------------------------------------------------------------------
 * PRODUCT DEFINITIONS
 *
 * fields       dimension inputs the page shows, and the only ones the API
 *              accepts for that product
 * threaded     whether a thread pitch is needed
 * ------------------------------------------------------------------------- */
const FIELDS = {
    diameter: { key: "diameter", label: "Nominal diameter" },
    pitch: { key: "pitch", label: "Thread pitch" },
    length: { key: "length", label: "Length" },
    threadLength: { key: "threadLength", label: "Thread length" },
    threadLength2: { key: "threadLength2", label: "Second thread length" },
    acrossFlats: { key: "acrossFlats", label: "Width across flats" },
    headHeight: { key: "headHeight", label: "Head height" },
    headDiameter: { key: "headDiameter", label: "Head diameter" },
    socketAcrossFlats: { key: "socketAcrossFlats", label: "Socket width across flats" },
    socketDepth: { key: "socketDepth", label: "Socket depth" },
    neckAcrossFlats: { key: "neckAcrossFlats", label: "Square neck width" },
    neckHeight: { key: "neckHeight", label: "Square neck height" },
    nutHeight: { key: "nutHeight", label: "Nut height" }
};

function pickFields(keys) {
    return keys.map((key) => FIELDS[key]);
}

const HEX_BOLT_FIELDS = ["diameter", "pitch", "length", "acrossFlats", "headHeight"];
const SOCKET_SCREW_FIELDS = [
    "diameter", "pitch", "length", "threadLength",
    "headDiameter", "headHeight", "socketAcrossFlats", "socketDepth"
];
const NUT_FIELDS = ["diameter", "pitch", "acrossFlats", "nutHeight"];

const PRODUCTS = Object.freeze({
    "hex-ft": Object.freeze({
        name: "Hex Bolt, Full Thread",
        category: "bolts",
        fields: pickFields(HEX_BOLT_FIELDS),
        threaded: true
    }),
    "hex-ht": Object.freeze({
        name: "Hex Bolt, Half Thread",
        category: "bolts",
        fields: pickFields(HEX_BOLT_FIELDS.concat("threadLength")),
        threaded: true
    }),
    "hex-blank": Object.freeze({
        name: "Hex Bolt Blank",
        category: "bolts",
        fields: pickFields(["diameter", "length", "acrossFlats", "headHeight"]),
        threaded: false
    }),
    "socket-head": Object.freeze({
        name: "Socket Head Cap Screw",
        category: "bolts",
        fields: pickFields(SOCKET_SCREW_FIELDS),
        threaded: true
    }),
    "countersunk": Object.freeze({
        name: "Countersunk Socket Screw",
        category: "bolts",
        fields: pickFields(SOCKET_SCREW_FIELDS),
        threaded: true
    }),
    "carriage": Object.freeze({
        name: "Carriage Bolt",
        category: "bolts",
        fields: pickFields([
            "diameter", "pitch", "length", "threadLength",
            "headDiameter", "headHeight", "neckAcrossFlats", "neckHeight"
        ]),
        threaded: true
    }),
    "stud-ft": Object.freeze({
        name: "Fully Threaded Stud",
        category: "studs",
        fields: pickFields(["diameter", "pitch", "length"]),
        threaded: true
    }),
    "stud-de": Object.freeze({
        name: "Double End Stud",
        category: "studs",
        fields: pickFields(["diameter", "pitch", "length", "threadLength", "threadLength2"]),
        threaded: true
    }),
    "threaded-rod": Object.freeze({
        name: "Threaded Rod",
        category: "studs",
        fields: pickFields(["diameter", "pitch", "length"]),
        threaded: true
    }),
    "hex-nut": Object.freeze({
        name: "Hex Nut",
        category: "nuts",
        fields: pickFields(NUT_FIELDS),
        threaded: true
    }),
    "heavy-hex-nut": Object.freeze({
        name: "Heavy Hex Nut",
        category: "nuts",
        fields: pickFields(NUT_FIELDS),
        threaded: true
    }),
    "jam-nut": Object.freeze({
        name: "Hex Jam Nut",
        category: "nuts",
        fields: pickFields(NUT_FIELDS),
        threaded: true
    }),
    "square-nut": Object.freeze({
        name: "Square Nut",
        category: "nuts",
        fields: pickFields(NUT_FIELDS),
        threaded: true
    }),
    "lock-nut": Object.freeze({
        name: "Nylon Insert Lock Nut",
        category: "nuts",
        fields: pickFields(NUT_FIELDS),
        threaded: true
    })
});

/* ---------------------------------------------------------------------------
 * REQUEST READING
 * ------------------------------------------------------------------------- */

function readProduct(payload) {
    const key = String(payload.product || "").trim();

    if (!Object.prototype.hasOwnProperty.call(PRODUCTS, key)) {
        throw new ValidationError(
            "Choose a product before calculating.",
            "product"
        );
    }

    return key;
}

function readUnit(payload) {
    const unit = payload.unit === undefined ? "mm" : payload.unit;

    if (unit !== "mm" && unit !== "in") {
        throw new ValidationError('Unit must be "mm" or "in".', "unit");
    }

    return unit;
}

/**
 * Chooses the stress-area factor from the thread system, not just the display
 * unit. An ASME table remains Unified even when the page shows millimetres;
 * a custom thread is Unified only when the page is using inches.
 */
function readStressFactor(payload) {
    const standard = String(payload.standard || "").trim().toLowerCase();

    if (standard.indexOf("asme-") === 0) {
        return UNIFIED_STRESS_DIAMETER_FACTOR;
    }

    if ((standard === "" || standard === "custom") && payload.unit === "in") {
        return UNIFIED_STRESS_DIAMETER_FACTOR;
    }

    return ISO_STRESS_DIAMETER_FACTOR;
}

/** Reads one dimension and returns it in millimetres. */
function readMillimetres(payload, field, factor, options) {
    const opts = options || {};
    const raw = payload.values ? payload.values[field.key] : undefined;

    if (raw === null || raw === undefined || String(raw).trim() === "") {
        throw new ValidationError(
            field.label + " is required. Please enter a valid positive number.",
            field.key
        );
    }

    const value = Number(raw);

    if (!Number.isFinite(value)) {
        throw new ValidationError(field.label + " must be a number.", field.key);
    }

    if (opts.allowZero && value === 0) {
        return 0;
    }

    if (value <= 0) {
        throw new ValidationError(
            field.label + " is required. Please enter a valid positive number.",
            field.key
        );
    }

    return value * factor;
}

function readDimensions(payload, product) {
    const unit = readUnit(payload);
    const factor = unit === "in" ? INCH_TO_MM : 1;
    const mm = {};

    for (const field of product.fields) {
        const allowZero = field.key === "threadLength" &&
            (payload.product === "carriage" || payload.product === "socket-head" ||
                payload.product === "countersunk");

        mm[field.key] = readMillimetres(payload, field, factor, { allowZero });
    }

    return { mm, factor, unit };
}

/* ---------------------------------------------------------------------------
 * SHARED GEOMETRY
 * ------------------------------------------------------------------------- */

function circleArea(diameter) {
    return (Math.PI / 4) * diameter * diameter;
}

function hexagonArea(acrossFlats) {
    return HEX_AREA_FACTOR * acrossFlats * acrossFlats;
}

/**
 * Effective cross-section of a threaded length.
 * The factor is supplied by readStressFactor(); the default keeps direct
 * callers on the ISO metric formula.
 */
function threadStressArea(diameter, pitch, diameterFactor) {
    const factor = diameterFactor === undefined
        ? ISO_STRESS_DIAMETER_FACTOR
        : diameterFactor;
    const effectiveDiameter = diameter - factor * pitch;

    if (effectiveDiameter <= 0) {
        throw new ValidationError(
            "The thread pitch is too coarse for this diameter. Check the nominal diameter and the pitch.",
            "pitch"
        );
    }

    return circleArea(effectiveDiameter);
}

/**
 * Physical material area of an external thread, used for mass/volume.
 *
 * The tensile stress area above is a mechanical design value, not the actual
 * cross-section of the threaded shank. For weight we use the average of the
 * major-diameter circle and the basic root-diameter circle:
 *
 *   A_thread = [ A(d) + A(d − 1.226869 × P) ] / 2
 *
 * This is a geometric approximation of the 60° thread form; it keeps the
 * same units as the other areas and avoids treating the bolt as a plain bar.
 */
function threadMaterialArea(diameter, pitch) {
    const rootDiameter = diameter - EXTERNAL_ROOT_DEPTH_FACTOR * pitch;

    if (rootDiameter <= 0) {
        throw new ValidationError(
            "The thread pitch is too coarse for this diameter. Check the nominal diameter and the pitch.",
            "pitch"
        );
    }

    return (circleArea(diameter) + circleArea(rootDiameter)) / 2;
}

function assertThreadLength(threadLength, length, field, label) {
    if (threadLength > length + 1e-9) {
        throw new ValidationError(
            (label || "Thread length") + " cannot be longer than the overall length.",
            field
        );
    }
}

/** Common result body: volume breakdown plus kg and lbs. */
function buildResult(context, weight) {
    return {
        product: context.productKey,
        productName: context.product.name,
        category: context.product.category,
        quantity: context.quantity,
        density: context.density,
        poundsPerKg: LBS_PER_KG,
        singlePounds: weight.singleWeight * LBS_PER_KG,
        totalPounds: weight.totalWeight * LBS_PER_KG,
        ...weight,
        ...context.breakdown
    };
}

/* ---------------------------------------------------------------------------
 * BOLT HEADS
 * ------------------------------------------------------------------------- */

/*
 * Hexagon head: a regular hexagonal prism, area (√3/2) × s², height k,
 * with the standard 30° top chamfer subtracted.
 */
function hexChamferDepth(acrossFlats) {
    /* Across corners of the regular hexagon used by the chamfer geometry. */
    const acrossCorners = acrossFlats / Math.cos(HEX_CHAMFER_ANGLE_RAD);
    const radialDrop = (acrossCorners - acrossFlats) / 2;
    return radialDrop / Math.tan(HEX_CHAMFER_ANGLE_RAD);
}

function hexChamferVolume(acrossFlats, availableDepth) {
    const depth = Math.min(hexChamferDepth(acrossFlats), availableDepth);
    /* The chamfer meets the top face on the circle tangent to the six flats. */
    const removedTopArea = hexagonArea(acrossFlats) - circleArea(acrossFlats);
    return 0.5 * removedTopArea * depth;
}

function hexHeadVolume(acrossFlats, headHeight) {
    const prism = hexagonArea(acrossFlats) * headHeight;
    const chamfer = hexChamferVolume(acrossFlats, headHeight);
    return Math.max(prism - chamfer, 0);
}

/*
 * Socket head cap screw: a cylinder π/4 × dk² × k with a hexagon socket
 * removed, socket volume = (√3/2) × s² × t.
 */
function socketHeadVolume(headDiameter, headHeight, socketAcrossFlats, socketDepth) {
    const outer = circleArea(headDiameter) * headHeight;
    const socket = hexagonArea(socketAcrossFlats) * socketDepth;

    if (socket >= outer) {
        throw new ValidationError(
            "The socket is larger than the head. Check the head and socket dimensions.",
            "socketDepth"
        );
    }

    return { volume: outer - socket, socketVolume: socket, outerVolume: outer };
}

/*
 * Countersunk head: a 90° cone frustum from the head diameter dk down to the
 * shank diameter d over the head height k, with the hexagon socket removed.
 *
 *   V = (π × k / 12) × (dk² + dk × d + d²)
 */
function countersunkHeadVolume(headDiameter, shankDiameter, headHeight,
    socketAcrossFlats, socketDepth) {
    const outer = (Math.PI * headHeight / 12) *
        (headDiameter * headDiameter + headDiameter * shankDiameter +
            shankDiameter * shankDiameter);
    const socket = hexagonArea(socketAcrossFlats) * socketDepth;

    if (socket >= outer) {
        throw new ValidationError(
            "The socket is larger than the countersunk head. Check the head and socket dimensions.",
            "socketDepth"
        );
    }

    return { volume: outer - socket, socketVolume: socket, outerVolume: outer };
}

/*
 * Carriage bolt: a domed head plus the square neck under it.
 *
 *   dome  a spherical cap of base diameter dk and height k:
 *         R = (r² + k²) / (2k),  V = π × k² × (3R − k) / 3
 *   neck  the square prism a² × f, less the round shank already counted
 */
function carriageHeadVolume(headDiameter, headHeight, neckAcrossFlats,
    neckHeight, shankDiameter) {
    const radius = headDiameter / 2;
    const sphereRadius = (radius * radius + headHeight * headHeight) /
        (2 * headHeight);
    const dome = (Math.PI * headHeight * headHeight *
        (3 * sphereRadius - headHeight)) / 3;
    const neck = Math.max(
        0,
        (neckAcrossFlats * neckAcrossFlats - circleArea(shankDiameter)) * neckHeight
    );

    return {
        volume: dome + neck,
        socketVolume: 0,
        outerVolume: dome + neck + circleArea(shankDiameter) * neckHeight
    };
}

/* ---------------------------------------------------------------------------
 * PRODUCT CALCULATIONS — BOLTS
 * ------------------------------------------------------------------------- */

/*
 * Hex bolt, full thread:
 *   head (hex prism) + threaded shank over the full length.
 */
function computeHexFullThread(mm, stressFactor) {
    const headVolume = hexHeadVolume(mm.acrossFlats, mm.headHeight);
    const materialArea = threadMaterialArea(mm.diameter, mm.pitch);
    const stressArea = threadStressArea(mm.diameter, mm.pitch, stressFactor);
    const threadVolume = materialArea * mm.length;

    return {
        volume: headVolume + threadVolume,
        breakdown: {
            headVolumeMM3: headVolume,
            shankVolumeMM3: 0,
            threadVolumeMM3: threadVolume,
            socketVolumeMM3: 0,
            stressAreaMM2: stressArea,
            threadMaterialAreaMM2: materialArea,
            threadLengthMM: mm.length
        }
    };
}

/*
 * Hex bolt, half thread:
 *   head + plain shank (full circle) + threaded length at the stress area.
 */
function computeHexHalfThread(mm, stressFactor) {
    assertThreadLength(mm.threadLength, mm.length, "threadLength");

    const headVolume = hexHeadVolume(mm.acrossFlats, mm.headHeight);
    const materialArea = threadMaterialArea(mm.diameter, mm.pitch);
    const stressArea = threadStressArea(mm.diameter, mm.pitch, stressFactor);
    const solidLength = mm.length - mm.threadLength;
    const shankVolume = circleArea(mm.diameter) * solidLength;
    const threadVolume = materialArea * mm.threadLength;

    return {
        volume: headVolume + shankVolume + threadVolume,
        breakdown: {
            headVolumeMM3: headVolume,
            shankVolumeMM3: shankVolume,
            threadVolumeMM3: threadVolume,
            socketVolumeMM3: 0,
            stressAreaMM2: stressArea,
            threadMaterialAreaMM2: materialArea,
            threadLengthMM: mm.threadLength
        }
    };
}

/*
 * Hex bolt blank: head + full-diameter shank, no thread at all.
 */
function computeHexBlank(mm) {
    const headVolume = hexHeadVolume(mm.acrossFlats, mm.headHeight);
    const shankVolume = circleArea(mm.diameter) * mm.length;

    return {
        volume: headVolume + shankVolume,
        breakdown: {
            headVolumeMM3: headVolume,
            shankVolumeMM3: shankVolume,
            threadVolumeMM3: 0,
            socketVolumeMM3: 0,
            stressAreaMM2: circleArea(mm.diameter),
            threadMaterialAreaMM2: circleArea(mm.diameter),
            threadLengthMM: 0
        }
    };
}

/*
 * Socket head cap screw: cylindrical socket head + plain shank + thread.
 */
function computeSocketHead(mm, stressFactor) {
    assertThreadLength(mm.threadLength, mm.length, "threadLength");

    const head = socketHeadVolume(
        mm.headDiameter,
        mm.headHeight,
        mm.socketAcrossFlats,
        mm.socketDepth
    );
    const materialArea = threadMaterialArea(mm.diameter, mm.pitch);
    const stressArea = threadStressArea(mm.diameter, mm.pitch, stressFactor);
    const solidLength = mm.length - mm.threadLength;
    const shankVolume = circleArea(mm.diameter) * solidLength;
    const threadVolume = materialArea * mm.threadLength;

    return {
        volume: head.volume + shankVolume + threadVolume,
        breakdown: {
            headVolumeMM3: head.volume,
            shankVolumeMM3: shankVolume,
            threadVolumeMM3: threadVolume,
            socketVolumeMM3: head.socketVolume,
            stressAreaMM2: stressArea,
            threadMaterialAreaMM2: materialArea,
            threadLengthMM: mm.threadLength
        }
    };
}

/*
 * Countersunk socket screw: 90° countersunk head + shank + thread.
 */
function computeCountersunk(mm, stressFactor) {
    assertThreadLength(mm.threadLength, mm.length, "threadLength");

    const head = countersunkHeadVolume(
        mm.headDiameter,
        mm.diameter,
        mm.headHeight,
        mm.socketAcrossFlats,
        mm.socketDepth
    );
    const materialArea = threadMaterialArea(mm.diameter, mm.pitch);
    const stressArea = threadStressArea(mm.diameter, mm.pitch, stressFactor);
    const solidLength = mm.length - mm.threadLength;
    const shankVolume = circleArea(mm.diameter) * solidLength;
    const threadVolume = materialArea * mm.threadLength;

    return {
        volume: head.volume + shankVolume + threadVolume,
        breakdown: {
            headVolumeMM3: head.volume,
            shankVolumeMM3: shankVolume,
            threadVolumeMM3: threadVolume,
            socketVolumeMM3: head.socketVolume,
            stressAreaMM2: stressArea,
            threadMaterialAreaMM2: materialArea,
            threadLengthMM: mm.threadLength
        }
    };
}

/*
 * Carriage bolt: domed head, square neck, plain shank and thread.
 */
function computeCarriage(mm, stressFactor) {
    assertThreadLength(mm.threadLength, mm.length, "threadLength");

    const head = carriageHeadVolume(
        mm.headDiameter,
        mm.headHeight,
        mm.neckAcrossFlats,
        mm.neckHeight,
        mm.diameter
    );
    const materialArea = threadMaterialArea(mm.diameter, mm.pitch);
    const stressArea = threadStressArea(mm.diameter, mm.pitch, stressFactor);
    const solidLength = mm.length - mm.threadLength;
    const shankVolume = circleArea(mm.diameter) * solidLength;
    const threadVolume = materialArea * mm.threadLength;

    return {
        volume: head.volume + shankVolume + threadVolume,
        breakdown: {
            headVolumeMM3: head.volume,
            shankVolumeMM3: shankVolume,
            threadVolumeMM3: threadVolume,
            socketVolumeMM3: 0,
            stressAreaMM2: stressArea,
            threadMaterialAreaMM2: materialArea,
            threadLengthMM: mm.threadLength
        }
    };
}

/* ---------------------------------------------------------------------------
 * PRODUCT CALCULATIONS — STUDS
 * ------------------------------------------------------------------------- */

/*
 * Fully threaded stud / threaded rod: threaded over the whole length.
 */
function computeFullThreadStud(mm, stressFactor) {
    const materialArea = threadMaterialArea(mm.diameter, mm.pitch);
    const stressArea = threadStressArea(mm.diameter, mm.pitch, stressFactor);
    const threadVolume = materialArea * mm.length;

    return {
        volume: threadVolume,
        breakdown: {
            headVolumeMM3: 0,
            shankVolumeMM3: 0,
            threadVolumeMM3: threadVolume,
            socketVolumeMM3: 0,
            stressAreaMM2: stressArea,
            threadMaterialAreaMM2: materialArea,
            threadLengthMM: mm.length
        }
    };
}

/*
 * Double end stud: thread at both ends, plain shank in the middle.
 */
function computeDoubleEndStud(mm, stressFactor) {
    const materialArea = threadMaterialArea(mm.diameter, mm.pitch);
    const stressArea = threadStressArea(mm.diameter, mm.pitch, stressFactor);

    assertThreadLength(mm.threadLength, mm.length, "threadLength", "First thread length");
    assertThreadLength(mm.threadLength2, mm.length, "threadLength2", "Second thread length");

    const middleLength = mm.length - mm.threadLength - mm.threadLength2;

    if (middleLength < 0) {
        throw new ValidationError(
            "The two thread lengths are longer than the stud. Shorten one of them or increase the overall length.",
            "threadLength2"
        );
    }

    const shankVolume = circleArea(mm.diameter) * middleLength;
    const threadVolume = materialArea * (mm.threadLength + mm.threadLength2);

    return {
        volume: shankVolume + threadVolume,
        breakdown: {
            headVolumeMM3: 0,
            shankVolumeMM3: shankVolume,
            threadVolumeMM3: threadVolume,
            socketVolumeMM3: 0,
            stressAreaMM2: stressArea,
            threadMaterialAreaMM2: materialArea,
            threadLengthMM: mm.threadLength + mm.threadLength2
        }
    };
}

/* ---------------------------------------------------------------------------
 * PRODUCT CALCULATIONS — NUTS
 * ------------------------------------------------------------------------- */

/*
 * Nut body: the outer prism less the threaded bore.
 *
 * The bore is not a plain hole: the internal thread leaves metal between the
 * minor diameter D1 and the major diameter d. For the weight the bore is
 * modelled with the average of those two areas:
 *
 *   A_bore = ( A(d) + A(D1) ) / 2,   D1 = d − 1.0825 × P
 *
 * This reproduces catalogue nut weights within about 2 %.
 */
function nutGeometry(mm, options) {
    const opts = options || {};
    const outerArea = opts.square
        ? mm.acrossFlats * mm.acrossFlats
        : hexagonArea(mm.acrossFlats);
    const majorArea = circleArea(mm.diameter);
    const minorDiameter = mm.diameter - MINOR_DIAMETER_FACTOR * mm.pitch;

    if (minorDiameter <= 0) {
        throw new ValidationError(
            "The thread pitch is too coarse for this diameter. Check the nominal diameter and the pitch.",
            "pitch"
        );
    }

    const minorArea = circleArea(minorDiameter);
    const boreArea = (majorArea + minorArea) / 2;

    if (boreArea >= outerArea) {
        throw new ValidationError(
            "The nut is smaller than its thread. Increase the width across flats.",
            "acrossFlats"
        );
    }

    /* A lock nut's nylon collar is not metal and is left out of the weight. */
    const height = opts.nylon
        ? Math.max(0.5 * mm.nutHeight, mm.nutHeight - NYLON_INSERT_DEPTH_MM)
        : mm.nutHeight;

    /* Hex nuts are chamfered on both faces; the 30° cone is derived from s. */
    const chamferLoss = opts.square
        ? 0
        : (hexagonArea(mm.acrossFlats) - circleArea(mm.acrossFlats)) *
          Math.min(hexChamferDepth(mm.acrossFlats), height / 2);
    const outerVolume = outerArea * height -
        Math.min(chamferLoss, (outerArea - boreArea) * height);

    return {
        outerArea,
        outerVolume,
        boreArea,
        height,
        volume: outerVolume - boreArea * height
    };
}

function computeHexNut(mm, stressFactor) {
    const nut = nutGeometry(mm);

    return {
        volume: nut.volume,
        breakdown: {
            headVolumeMM3: nut.outerVolume,
            shankVolumeMM3: 0,
            threadVolumeMM3: 0,
            socketVolumeMM3: nut.boreArea * nut.height,
            stressAreaMM2: threadStressArea(mm.diameter, mm.pitch, stressFactor),
            boreAreaMM2: nut.boreArea,
            threadLengthMM: nut.height
        }
    };
}

function computeSquareNut(mm, stressFactor) {
    const nut = nutGeometry(mm, { square: true });

    return {
        volume: nut.volume,
        breakdown: {
            headVolumeMM3: nut.outerVolume,
            shankVolumeMM3: 0,
            threadVolumeMM3: 0,
            socketVolumeMM3: nut.boreArea * nut.height,
            stressAreaMM2: threadStressArea(mm.diameter, mm.pitch, stressFactor),
            boreAreaMM2: nut.boreArea,
            threadLengthMM: nut.height
        }
    };
}

function computeLockNut(mm, stressFactor) {
    const nut = nutGeometry(mm, { nylon: true });

    return {
        volume: nut.volume,
        breakdown: {
            /* Use the same metal height as the volume model so the reported
               breakdown always satisfies head − socket = volume. */
            headVolumeMM3: nut.outerVolume,
            shankVolumeMM3: 0,
            threadVolumeMM3: 0,
            socketVolumeMM3: nut.boreArea * nut.height,
            stressAreaMM2: threadStressArea(mm.diameter, mm.pitch, stressFactor),
            boreAreaMM2: nut.boreArea,
            threadLengthMM: nut.height
        }
    };
}

/* ---------------------------------------------------------------------------
 * DISPATCH
 * ------------------------------------------------------------------------- */

const CALCULATORS = {
    "hex-ft": computeHexFullThread,
    "hex-ht": computeHexHalfThread,
    "hex-blank": computeHexBlank,
    "socket-head": computeSocketHead,
    "countersunk": computeCountersunk,
    "carriage": computeCarriage,
    "stud-ft": computeFullThreadStud,
    "stud-de": computeDoubleEndStud,
    "threaded-rod": computeFullThreadStud,
    "hex-nut": computeHexNut,
    "heavy-hex-nut": computeHexNut,
    "jam-nut": computeHexNut,
    "square-nut": computeSquareNut,
    "lock-nut": computeLockNut
};

/* ---------------------------------------------------------------------------
 * VALIDATION OF THE COMBINED SHAPE
 * ------------------------------------------------------------------------- */

function validateShape(productKey, mm, payload) {
    const limits = { diameter: 1000, length: 100000, acrossFlats: 5000 };

    if (mm.diameter > limits.diameter) {
        throw new ValidationError(
            "The diameter is too large for this calculator.",
            "diameter"
        );
    }

    if (mm.length !== undefined && mm.length > limits.length) {
        throw new ValidationError(
            "The length is too large for this calculator.",
            "length"
        );
    }

    if (mm.acrossFlats !== undefined && mm.acrossFlats > limits.acrossFlats) {
        throw new ValidationError(
            "The width across flats is too large for this calculator.",
            "acrossFlats"
        );
    }

    const nutProducts = ["hex-nut", "heavy-hex-nut", "jam-nut", "square-nut", "lock-nut"];

    if (nutProducts.indexOf(productKey) !== -1) {
        if (mm.acrossFlats <= mm.diameter) {
            throw new ValidationError(
                "The width across flats must be larger than the nominal diameter.",
                "acrossFlats"
            );
        }

        if (productKey === "lock-nut" && mm.nutHeight <= NYLON_INSERT_DEPTH_MM) {
            throw new ValidationError(
                "The nut height is too small for a nylon insert lock nut.",
                "nutHeight"
            );
        }

        return;
    }

    if (productKey === "socket-head" || productKey === "countersunk") {
        if (mm.headDiameter <= mm.diameter) {
            throw new ValidationError(
                "The head diameter must be larger than the shank diameter.",
                "headDiameter"
            );
        }

        if (mm.socketAcrossFlats >= mm.headDiameter) {
            throw new ValidationError(
                "The socket must be smaller than the head diameter.",
                "socketAcrossFlats"
            );
        }

        if (mm.socketDepth >= mm.headHeight) {
            throw new ValidationError(
                "The socket depth must be smaller than the head height.",
                "socketDepth"
            );
        }
    }

    if (productKey === "carriage") {
        if (mm.headDiameter <= mm.diameter) {
            throw new ValidationError(
                "The head diameter must be larger than the shank diameter.",
                "headDiameter"
            );
        }

        if (mm.neckAcrossFlats <= mm.diameter) {
            throw new ValidationError(
                "The square neck must be larger than the shank diameter.",
                "neckAcrossFlats"
            );
        }
    }

    if (productKey === "hex-ht" && mm.threadLength <= 0) {
        throw new ValidationError(
            "The thread length is required for a half thread bolt.",
            "threadLength"
        );
    }
}

/* ---------------------------------------------------------------------------
 * PUBLIC ENTRY POINT
 * ------------------------------------------------------------------------- */

function compute(payload) {
    const body = payload || {};
    const productKey = readProduct(body);
    const product = PRODUCTS[productKey];
    const { mm } = readDimensions(body, product);
    const quantity = readQuantity(body);
    const density = readDensity(body);
    const stressFactor = readStressFactor(body);

    if (!CALCULATORS[productKey]) {
        throw new ValidationError(
            "This product is not supported by the calculator.",
            "product"
        );
    }

    validateShape(productKey, mm, body);

    const calculation = CALCULATORS[productKey](mm, stressFactor);

    const finiteFields = [
        calculation.volume,
        calculation.breakdown.headVolumeMM3,
        calculation.breakdown.shankVolumeMM3,
        calculation.breakdown.threadVolumeMM3,
        calculation.breakdown.stressAreaMM2
    ];

    if (calculation.breakdown.threadMaterialAreaMM2 !== undefined) {
        finiteFields.push(calculation.breakdown.threadMaterialAreaMM2);
    }

    assertFinite(finiteFields);

    if (calculation.volume <= 0) {
        throw new ValidationError(
            "The entered dimensions do not describe a solid part. Check the values."
        );
    }

    const weight = weightFromVolume(calculation.volume, density, quantity);

    assertFinite([weight.singleWeight, weight.totalWeight, weight.volumeM3]);

    return buildResult({
        productKey,
        product,
        quantity,
        density,
        breakdown: calculation.breakdown
    }, weight);
}

module.exports = {
    PRODUCTS,
    compute,
    threadStressArea,
    threadMaterialArea,
    hexagonArea,
    LBS_PER_KG
};
