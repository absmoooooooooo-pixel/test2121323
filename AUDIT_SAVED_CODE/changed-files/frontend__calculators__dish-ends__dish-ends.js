/* ==================================================
   DISH ENDS CALCULATOR JAVASCRIPT START
   Five dish end types: flat, torispherical, ellipsoidal,
   hemispherical and elliptical head template.
   Contains the geometry, the live SVG drawing engine,
   validation and the calculation results.
================================================== */
"use strict";

(function () {
    /* ==================================================
       CONSTANTS
    ================================================== */

    var MM_PER_INCH = 25.4;

    var MATERIALS = window.MW_DISH_MATERIALS || {};

    var TYPE_INFO = {
        flat: {
            name: "Flat Head",
            title: "Flat Head Weight Calculator",
            drawingTitle: "FLAT HEAD \u00b7 SECTION",
            drawingAlt: "Flanged flat head section with inside diameter, crown height, knuckle radius and straight flange dimensions",
            drawingNote: "Flanged flat head: flat crown, knuckle radius R, straight flange SF. H = R for this profile.",
            equation: "W = (\u03c0 \u00d7 R\u00b2 + 2\u03c0 \u00d7 R \u00d7 SF) \u00d7 T \u00d7 \u03c1 \u00f7 10\u2079",
            variables: "W = Weight (kg) &middot; R = Inside radius, ID &divide; 2 (mm) &middot; SF = Straight flange (mm) &middot; T = Thickness (mm) &middot; &rho; = Density (kg/m&sup3;)",
            resultNote: "Flat crown plus knuckle and straight flange; the knuckle fillet area is not added to the developed area.",
            method: "<ol class=\"small-text\" style=\"margin: 10px 0 14px 18px; color: var(--muted, #718087); line-height: 1.6;\">" +
                "<li>Flat plate area: A<sub>plate</sub> = \u03c0 \u00d7 R\u00b2 with R = ID \u00f7 2.</li>" +
                "<li>Straight face: A<sub>SF</sub> = 2\u03c0 \u00d7 R \u00d7 SF, treated as a cylindrical flange of height SF.</li>" +
                "<li>Developed blank: \u00d8 = 2 \u00d7 \u221a((A<sub>plate</sub> + A<sub>SF</sub>) \u00f7 \u03c0).</li>" +
                "<li>The knuckle radius R is the corner radius between the flat crown and the straight flange; the crown diameter is ID \u2212 2R and the crown sits R above the tangent line.</li>" +
                "</ol>",
            faqs: [
                {
                    q: "How is the weight of a flanged flat head calculated?",
                    a: "The head is a flat circular crown with a straight cylindrical flange. The developed area is &pi; &times; R&sup2; for the crown plus 2&pi; &times; R &times; SF for the flange, where R is the inside radius, ID &divide; 2. Weight is that area &times; plate thickness &times; density: ID 1000 mm with SF 40 mm and T 6 mm in carbon steel gives 42.91 kg."
                },
                {
                    q: "Why does the drawing dimension the crown height as H = R?",
                    a: "A flanged flat head is a flat crown bent down into a straight flange through a corner radius R. The crown stays at the level of the top of that bend, so its height above the tangent line where the knuckle turns vertical equals the knuckle radius. The flat crown diameter is then ID &minus; 2R."
                },
                {
                    q: "Does the knuckle radius change the calculated weight?",
                    a: "No. The calculator develops the flat crown (&pi;R&sup2;) and the cylindrical flange (2&pi;R &middot; SF); the small fillet surface of the knuckle is not added, which keeps the estimate marginally conservative. The knuckle still sets the drawing and the crown diameter."
                },
                {
                    q: "Why is a flanged flat head lighter than a dished head of the same size?",
                    a: "For the same diameter and thickness its developed area is the smallest of the dish end types: the crown is 0.785 ID&sup2;, against about 1.084 ID&sup2; for a 2:1 semi-ellipsoidal head and 1.571 ID&sup2; for a hemispherical head. It carries less pressure for the same thickness, so it usually needs stiffening or a heavier plate."
                },
                {
                    q: "Which knuckle radius should I enter?",
                    a: "Use the corner radius of your former or design drawing, typically a few per cent of the inside diameter. It must be smaller than the inside radius (ID &divide; 2) so that the flat crown ID &minus; 2R stays positive; the field is validated on that rule."
                },
                {
                    q: "Is a forming or trim allowance included in the blank diameter?",
                    a: "No. The blank is the area-equivalent circle 2 &times; &radic;(A &divide; &pi;). Forming stretch, edge trim, weld prep and any thinning allowance are shop decisions and are added on top of it."
                }
            ]
        },
        torispherical: {
            name: "Torispherical Head",
            title: "Torispherical Head Weight Calculator",
            drawingTitle: "TORISPHERICAL HEAD \u00b7 SECTION",
            drawingAlt: "Torispherical head section showing crown radius, knuckle radius, head height and straight flange",
            drawingNote: "Crown radius taken as the inside diameter; R is the knuckle radius as entered.",
            equation: "W = (A<sub>knuckle</sub> + A<sub>crown</sub> + A<sub>SF</sub>) \u00d7 T \u00d7 \u03c1 \u00f7 10\u2079",
            variables: "W = Weight (kg) &middot; C.R = Crown radius = ID (mm) &middot; K.R = Knuckle radius (mm) &middot; R = Inside radius, ID &divide; 2 (mm) &middot; &theta;k, &theta;c = Knuckle and crown arc angles &middot; &rho; = Density (kg/m&sup3;)",
            resultNote: "Crown radius is taken as the inside diameter; the crown zone and the knuckle torus are both counted.",
            method: "<ol class=\"small-text\" style=\"margin: 10px 0 14px 18px; color: var(--muted, #718087); line-height: 1.6;\">" +
                "<li>Knuckle angle: \u03b8<sub>k</sub> = cos\u207b\u00b9((R \u2212 K.R) \u00f7 (C.R \u2212 K.R)); crown angle \u03b8<sub>c</sub> = 90\u00b0 \u2212 \u03b8<sub>k</sub>.</li>" +
                "<li>Dish height: H = C.R \u2212 \u221a((C.R \u2212 K.R)\u00b2 \u2212 (R \u2212 K.R)\u00b2).</li>" +
                "<li>Knuckle area (torus): A = 2\u03c0 \u00d7 K.R \u00d7 [(R \u2212 K.R) \u00d7 \u03b8<sub>k</sub> + K.R \u00d7 sin \u03b8<sub>k</sub>].</li>" +
                "<li>Crown area (spherical zone): A = 2\u03c0 \u00d7 C.R \u00d7 (H \u2212 K.R \u00d7 sin \u03b8<sub>k</sub>).</li>" +
                "<li>Straight face: A<sub>SF</sub> = 2\u03c0 \u00d7 R \u00d7 SF. The crown radius is fixed at the inside diameter, which is the standard torispherical proportion.</li>" +
                "</ol>",
            faqs: [
                {
                    q: "How is the height of a torispherical head calculated?",
                    a: "The crown is spherical with radius C.R and the knuckle is a torus of radius K.R. Where the two meet, the height above the tangent line is H = C.R &minus; &radic;((C.R &minus; K.R)&sup2; &minus; (R &minus; K.R)&sup2;) with R = ID &divide; 2. The height is therefore calculated from the diameter and the two radii, not entered."
                },
                {
                    q: "Why is the crown radius taken as the inside diameter?",
                    a: "C.R = ID is the standard 100% crown proportion for torispherical heads, normally used with a knuckle of about 6% to 10% of the diameter. Fixing the crown radius leaves the diameter, the knuckle radius, the straight flange and the thickness as the only inputs."
                },
                {
                    q: "How is the knuckle area calculated?",
                    a: "The knuckle is a torus swept about the head axis: A = 2&pi; &times; K.R &times; [(R &minus; K.R) &times; &theta;k + K.R &times; sin &theta;k], where &theta;k is the knuckle arc angle in radians. The arc runs from the tangent point to the start of the vertical flange."
                },
                {
                    q: "How is the crown area calculated?",
                    a: "The crown is the spherical zone of radius C.R above the tangent point: A = 2&pi; &times; C.R &times; (H &minus; K.R &times; sin &theta;k). Only the part of the sphere above the knuckle is counted, so the crown area falls as the knuckle grows."
                },
                {
                    q: "What knuckle radius is normal for a torispherical head?",
                    a: "Standard flanged and dished heads use about 6% of the inside diameter, and some specifications use 10%; for ID 1000 mm that is 60 mm to 100 mm. The value must stay below ID &divide; 2 and it is the radius labelled R on the drawing."
                },
                {
                    q: "Why is the blank diameter larger than the inside diameter?",
                    a: "The crown and the knuckle together have more surface than a flat disc of the same diameter, so the area-equivalent blank 2 &times; &radic;(A &divide; &pi;) is larger than ID. A production blank also needs a forming and trim allowance on top of that."
                }
            ]
        },
        ellipsoidal: {
            name: "Ellipsoidal Head",
            title: "Ellipsoidal Head Weight Calculator",
            drawingTitle: "ELLIPSOIDAL HEAD \u00b7 SECTION",
            drawingAlt: "Semi-ellipsoidal head section showing inside diameter, head height, crown radius and straight flange",
            drawingNote: "Semi-ellipsoidal profile of semi-axes ID \u00f7 2 and H; R is the crown radius of curvature.",
            equation: "W = A \u00d7 T \u00d7 \u03c1 \u00f7 10\u2079",
            variables: "W = Weight (kg) &middot; A = Developed surface area (mm&sup2;) &middot; T = Thickness (mm) &middot; &rho; = Density (kg/m&sup3;)",
            resultNote: "Dish area is the semi-ellipsoidal surface for a = ID \u00f7 2 and b = H; the straight flange is added separately.",
            method: "<ol class=\"small-text\" style=\"margin: 10px 0 14px 18px; color: var(--muted, #718087); line-height: 1.6;\">" +
                "<li>The dish is a true semi-ellipsoid with a = ID \u00f7 2 and b = H, so a 2:1 head is H = ID \u00f7 4.</li>" +
                "<li>Surface area of the semi-ellipsoid (a &gt; b, e = \u221a(1 \u2212 b\u00b2 \u00f7 a\u00b2)): A = \u03c0a\u00b2 + (\u03c0b\u00b2 \u00f7 2e) \u00d7 ln((1 + e) \u00f7 (1 \u2212 e)); for b &gt; a the asin form is used.</li>" +
                "<li>Straight face: A<sub>SF</sub> = 2\u03c0 \u00d7 R \u00d7 SF, measured below the tangent line.</li>" +
                "<li>Developed blank: \u00d8 = 2 \u00d7 \u221a(A \u00f7 \u03c0), the area-equivalent flat plate diameter.</li>" +
                "</ol>",
            faqs: [
                {
                    q: "How is the area of a semi-ellipsoidal head calculated?",
                    a: "The dish is half an ellipsoid of revolution with semi-axes a = ID &divide; 2 and b = H. With e = &radic;(1 &minus; b&sup2; &divide; a&sup2;) the area is &pi;a&sup2; + (&pi;b&sup2; &divide; 2e) &times; ln((1 + e) &divide; (1 &minus; e)); when the head is taller than it is wide (b &gt; a) the same integral is evaluated with the inverse-sine form."
                },
                {
                    q: "What height gives a standard 2:1 ellipsoidal head?",
                    a: "A 2:1 head has D &divide; 2H = 2, so H = ID &divide; 4: 250 mm for ID 1000 mm. The results show the D &divide; 2H ratio of the values you entered, so you can confirm the profile before relying on the weight."
                },
                {
                    q: "Why do the area, blank and weight change with the height?",
                    a: "The height is the vertical semi-axis of the ellipsoid. A flatter dish (smaller H) has less surface for the same diameter, so the area, blank diameter and weight all fall; as H approaches ID &divide; 2 the area approaches the hemispherical 2&pi;R&sup2;."
                },
                {
                    q: "Is a 2:1 ellipsoidal head deeper than a torispherical head?",
                    a: "Yes, for the same diameter: H = 0.25 ID for a 2:1 ellipsoidal head, against about 0.19 ID for a torispherical head with C.R = ID and a 10% knuckle. The taller dish develops more area, so it weighs more at the same thickness."
                },
                {
                    q: "Where does the developed blank diameter come from?",
                    a: "It is the diameter of the flat plate with the same area as the head, 2 &times; &radic;(A &divide; &pi;). A double-curved surface cannot be flattened without distortion, so this is an area-equivalent blank rather than a true development."
                },
                {
                    q: "Is the straight flange included in the area?",
                    a: "Yes. The straight flange is a cylinder of height SF below the tangent line with area 2&pi; &times; R &times; SF, and it is added to the dish area before the blank and the weight are calculated."
                }
            ]
        },
        hemispherical: {
            name: "Hemispherical Head",
            title: "Hemispherical Head Weight Calculator",
            drawingTitle: "HEMISPHERICAL HEAD \u00b7 SECTION",
            drawingAlt: "Hemispherical head section showing inside diameter, radius, height and straight flange",
            drawingNote: "Exactly half of a sphere: H = R = ID \u00f7 2.",
            equation: "W = (2\u03c0 \u00d7 R\u00b2 + 2\u03c0 \u00d7 R \u00d7 SF) \u00d7 T \u00d7 \u03c1 \u00f7 10\u2079",
            variables: "W = Weight (kg) &middot; R = Inside radius = H = ID &divide; 2 (mm) &middot; SF = Straight flange (mm) &middot; T = Thickness (mm) &middot; &rho; = Density (kg/m&sup3;)",
            resultNote: "A half sphere: the height equals the inside radius and the dome area is 2\u03c0R\u00b2.",
            method: "<ol class=\"small-text\" style=\"margin: 10px 0 14px 18px; color: var(--muted, #718087); line-height: 1.6;\">" +
                "<li>Dome area of a half sphere: A<sub>dome</sub> = 2\u03c0 \u00d7 R\u00b2 with R = ID \u00f7 2.</li>" +
                "<li>Dish height is fixed by the geometry: H = R.</li>" +
                "<li>Straight face: A<sub>SF</sub> = 2\u03c0 \u00d7 R \u00d7 SF.</li>" +
                "<li>Developed blank: \u00d8 = 2 \u00d7 \u221a(A \u00f7 \u03c0), which is \u221a2 \u00d7 ID when SF = 0.</li>" +
                "</ol>",
            faqs: [
                {
                    q: "Why is the height of a hemispherical head not an input?",
                    a: "A half sphere is fully defined by its diameter: the crown height is the inside radius, H = R = ID &divide; 2. The calculator shows R as a calculated field beside the diameter, so the two can never disagree."
                },
                {
                    q: "How is the weight of a hemispherical head calculated?",
                    a: "The dome is half a sphere with area 2&pi;R&sup2;, and the straight flange adds 2&pi; &times; R &times; SF. Multiplying the total area by the plate thickness and the density gives the weight; at ID 1000 mm the dome alone is 1.571 m&sup2;."
                },
                {
                    q: "Why does it weigh more than an ellipsoidal head of the same diameter?",
                    a: "Its dome area is 1.571 ID&sup2;, against about 1.084 ID&sup2; for a 2:1 semi-ellipsoidal head, so for the same thickness and material the dome is roughly 45% heavier before the straight flange is counted."
                },
                {
                    q: "What blank diameter does a hemispherical head need?",
                    a: "With no straight flange the dome area equals the area of a circle of diameter &radic;2 &times; ID, so the blank is about 1.414 &times; ID: 1414 mm for ID 1000 mm. A straight flange increases the blank further."
                },
                {
                    q: "Are inside or outside dimensions used?",
                    a: "The calculator works on the inside surface, matching the inside diameter you enter. Using outside dimensions would raise the area by roughly 2T/R, which is small beside forming and mill tolerances for normal plate thicknesses."
                },
                {
                    q: "Is a forming allowance included?",
                    a: "No. The blank diameter is area-equivalent only; forming stretch, edge trim, weld prep and thinning allowance are added by the fabricator."
                }
            ]
        },
        template: {
            name: "Elliptical Head Template",
            title: "Elliptical Head Template Calculator",
            drawingTitle: "ELLIPTICAL HEAD \u00b7 TEMPLATE",
            drawingAlt: "Elliptical head template with radial divisions, section and developed blank",
            drawingNote: "Section with radial division lines and the area-equivalent developed blank.",
            equation: "W = A \u00d7 T \u00d7 \u03c1 \u00f7 10\u2079",
            variables: "W = Weight (kg) &middot; A = Developed surface area (mm&sup2;) &middot; T = Thickness (mm) &middot; &rho; = Density (kg/m&sup3;)",
            resultNote: "The blank is the area-equivalent plate; a shop forming and trim allowance must be added.",
            method: "<ol class=\"small-text\" style=\"margin: 10px 0 14px 18px; color: var(--muted, #718087); line-height: 1.6;\">" +
                "<li>The meridian is a quarter ellipse; the true length from the apex to a station is integrated from s(t) = \u222b\u2080\u1d57 \u221a(R\u00b2cos\u00b2u + H\u00b2sin\u00b2u) du.</li>" +
                "<li>The circumference is divided into the selected number of equal angular divisions (12 to 96); each station is reported with its plan radius, height, meridian length and blank coordinates.</li>" +
                "<li>The developed blank is the area-equivalent flat plate: \u00d8 = 2 \u00d7 \u221a(A \u00f7 \u03c0).</li>" +
                "<li>A double-curved surface cannot be flattened without distortion, so the blank is an area-equivalent template. Forming, weld and trim allowances are a shop decision and are not included.</li>" +
                "</ol>",
            faqs: [
                {
                    q: "What is the elliptical head template used for?",
                    a: "It produces the shop development of one head: the meridian length from the apex to each station, the plan radius and height of that station, and the area-equivalent blank with the marking coordinates."
                },
                {
                    q: "How are the blank X and Y coordinates used?",
                    a: "Each station is reported at its azimuth. Blank X and Y give the point on the blank circumference at that azimuth, so the rim can be divided into the same angles; the meridian length in the table is then stepped out along that radial line from the centre to place the station."
                },
                {
                    q: "What do the development divisions change?",
                    a: "They divide the circumference into 12 to 96 equal angular steps and control the station table and the radial lines drawn on the section and the blank. More divisions give a finer template; the area, blank diameter and weight do not change."
                },
                {
                    q: "Why is the blank a circle when the head is not developable?",
                    a: "A double-curved surface cannot be flattened without stretching. The circle is the area-equivalent blank, 2 &times; &radic;(A &divide; &pi;): a flat plate of that diameter has the same surface area as the head, so it is the minimum plate size before allowances."
                },
                {
                    q: "Does the template include the straight flange?",
                    a: "Yes. The straight flange is part of the developed area and is drawn below the tangent line, so the blank, the station table and the weight all include it."
                }
            ]
        }
    };

    /* Worked example geometry per head type: ID 1000 mm, T 6 mm, carbon steel. */
    var EXAMPLE_GEOMETRY = {
        flat: { id: 1000, kr: 100, sf: 40, h: 0, t: 6 },
        torispherical: { id: 1000, kr: 100, sf: 40, h: 0, t: 6 },
        ellipsoidal: { id: 1000, kr: 0, sf: 40, h: 250, t: 6 },
        hemispherical: { id: 1000, kr: 0, sf: 40, h: 0, t: 6 },
        template: { id: 1000, kr: 0, sf: 40, h: 250, t: 6 }
    };

    var EXAMPLE_DENSITY = 7850;

    /* Short labels keep the worked-example tiles in line with the rest of
       the site; the form fields keep their fuller engineering labels. */
    var EXAMPLE_LABELS = {
        id: "Inside Diameter (ID)",
        kr: "Knuckle Radius (R)",
        h: "Dish Height (H)",
        sf: "Straight Face (SF)",
        t: "Thickness (T)"
    };

    function exampleExpression(type, r) {
        var half = fmt(r.R, 0);
        var face = fmt(r.SF, 0);
        var flange = " + 2\u03c0 \u00d7 " + half + " \u00d7 " + face;

        if (type === "flat") {
            return "\u03c0 \u00d7 " + half + "\u00b2" + flange;
        }
        if (type === "hemispherical") {
            return "2\u03c0 \u00d7 " + half + "\u00b2" + flange;
        }
        if (type === "torispherical") {
            return "A<sub>knuckle</sub> + A<sub>crown</sub>" + flange;
        }
        return "\u03c0a\u00b2 + (\u03c0b\u00b2 \u00f7 2e) \u00d7 ln((1 + e) \u00f7 (1 \u2212 e))" + flange;
    }

    async function renderExample(type) {
        if (!dom.methodExample) {
            return;
        }

        var ex = EXAMPLE_GEOMETRY[type];
        var r;

        try {
            r = await MWCalc.calculate("dish-ends", {
                type: type,
                values: { id: ex.id, kr: ex.kr, h: ex.h, sf: ex.sf, t: ex.t },
                unit: "mm",
                density: EXAMPLE_DENSITY,
                quantity: 1,
                divisions: state.divisions,
                materialName: "Carbon Steel"
            });
        } catch (error) {
            dom.methodExample.innerHTML =
                '<div class="example-heading"><h3>Calculation Example</h3></div>' +
                '<p class="small-text">Example unavailable.</p>';
            return;
        }

        /* The user may have switched type while the request was in flight. */
        if (state.type !== type) {
            return;
        }

        var values = TYPE_FIELDS[type].map(function (key) {
            var meta = FIELD_META[key];
            return '<div class="example-value">' +
                '<span class="example-value-label">' + (EXAMPLE_LABELS[key] || meta.label) + "</span>" +
                "<strong>" + fmt(ex[key], 0) + " <small>mm</small></strong>" +
                "</div>";
        });

        values.push('<div class="example-value example-value-density">' +
            '<span class="example-value-label">Material Density (&rho;)</span>' +
            "<strong>" + fmt(EXAMPLE_DENSITY, 0) + " <small>kg/m&sup3;</small></strong>" +
            '<span class="example-value-note">Carbon Steel</span>' +
            "</div>");

        var area = fmt(r.areaTotal, 0);
        var equation = "A = " + exampleExpression(type, r) + " = " + area + " mm&sup2;" +
            " &rarr; W = " + area + " &times; " + fmt(ex.t, 0) +
            ' &times; <span class="example-density-term">' + fmt(EXAMPLE_DENSITY, 0) + "</span> &divide; 10&#8313;";

        dom.methodExample.innerHTML =
            '<div class="example-heading">' +
            "<h3>Calculation Example</h3>" +
            '<span class="example-material-badge">' + TYPE_INFO[type].name + " &middot; Carbon Steel</span>" +
            "</div>" +
            '<div class="example-values">' + values.join("") + "</div>" +
            '<div class="example-step">' +
            '<span class="example-step-label">Calculation</span>' +
            '<p class="example-equation">' + equation + "</p>" +
            '<p class="example-density-callout">' +
            '<span class="example-density-icon" aria-hidden="true">&times;</span>' +
            " Material density (" + fmt(EXAMPLE_DENSITY, 0) + " kg/m&sup3;) is multiplied in this step." +
            "</p>" +
            "</div>" +
            '<div class="example-result">' +
            '<span class="example-result-label">Weight =</span>' +
            "<strong>" + weightText(r.weight) + "</strong>" +
            "</div>";
    }

    function renderFaqs(type) {
        if (!dom.faqList) {
            return;
        }
        dom.faqList.innerHTML = TYPE_INFO[type].faqs.map(function (item) {
            return '<details class="plate-faq-item">' +
                "<summary>" + item.q + "</summary>" +
                '<div class="plate-faq-answer"><p>' + item.a + "</p></div>" +
                "</details>";
        }).join("");
    }

    function bindDensityToggle() {
        var toggle = $("dishDensityToggle");
        var rows = document.querySelectorAll("#dishDensityTable .density-extra");

        if (!toggle || !rows.length) {
            return;
        }

        toggle.addEventListener("click", function () {
            var open = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", String(!open));
            toggle.classList.toggle("is-open", !open);
            Array.prototype.forEach.call(rows, function (row) {
                row.hidden = open;
            });
        });
    }

    var TYPE_FIELDS = {
        flat: ["id", "kr", "sf", "t"],
        torispherical: ["id", "kr", "sf", "t"],
        ellipsoidal: ["id", "h", "sf", "t"],
        hemispherical: ["id", "sf", "t"],
        template: ["id", "h", "sf", "t"]
    };

    var FIELD_META = {
        id: { label: "Dish Inside Diameter", notation: "ID" },
        kr: { label: "Dish Knuckle Radius", notation: "R" },
        sf: { label: "Straight Face", notation: "SF" },
        h: { label: "Dish Total Height", notation: "H" },
        t: { label: "Dish Thickness", notation: "T" }
    };

    var PLACEHOLDERS = {
        mm: { id: "e.g. 1000", kr: "e.g. 100", sf: "e.g. 40 (0 if none)", h: "e.g. 250", t: "e.g. 6" },
        in: { id: "e.g. 39.3701", kr: "e.g. 3.937", sf: "e.g. 1.5748 (0 if none)", h: "e.g. 9.8425", t: "e.g. 0.2362" }
    };

    var UNIT_NOTE = {
        mm: "All dimensions are in mm.",
        in: "All dimensions are in inches."
    };

    var DIVISIONS = [12, 24, 36, 48, 72, 96];

    var STYLE = {
        outline: { stroke: "#182b32", width: 1.8, dash: null },
        hidden: { stroke: "#8298a0", width: 1.1, dash: [7, 4] },
        ref: { stroke: "#9db0b4", width: 1, dash: [6, 4] },
        centre: { stroke: "#b4c3c6", width: 0.9, dash: [18, 3, 2, 3] },
        dim: { stroke: "#526a70", width: 0.95, dash: null },
        ext: { stroke: "#a7b8bb", width: 0.7, dash: null },
        dev: { stroke: "#0f9d94", width: 0.9, dash: null }
    };

    var TEXT_CLASS = { dim: "t-dim", label: "t-label", note: "t-note", title: "t-title" };
    var TEXT_COLOR = { dim: "#42595e", label: "#182b32", note: "#718087", title: "#3f5b60" };
    var MATERIAL_FILL = "#e9f1f1";

    var state = {
        /* null until a dish end type is chosen: the page opens on a prompt, not
           on another type's calculator. */
        type: null,
        unit: "mm",
        mm: { id: null, kr: null, sf: null, h: null, t: null },
        /* Every type keeps its own entered values, so switching never moves a
           dimension into a field of a profile it does not belong to. */
        byType: {},
        divisions: 24,
        material: "carbon-steel",
        densityEdited: false,
        quantity: 1,
        hasResult: false,
        /* Live recalculation turns on with the first successful calculation
           and stays on until the type changes or the form is reset, so a
           temporarily invalid field never switches it off. */
        autoCalc: false,
        last: null,
        /* Every run of calculate() takes the next number, so a slow response
           cannot overwrite the result of a newer one. */
        calcToken: 0
    };

    var dom = {};

    /* ==================================================
       SMALL HELPERS
    ================================================== */

    /* The page heading before a type name replaces it. */
    var BASE_TITLE = "";

    function blankValues() {
        return { id: null, kr: null, sf: null, h: null, t: null };
    }

    function typeValues(type) {
        if (!state.byType[type]) {
            state.byType[type] = blankValues();
        }
        return state.byType[type];
    }

    function $(id) {
        return document.getElementById(id);
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function fmt(value, decimals) {
        var places = decimals === undefined ? 2 : decimals;
        var safe = Number.isFinite(value) ? value : 0;
        return safe.toLocaleString("en-IN", {
            minimumFractionDigits: places,
            maximumFractionDigits: places
        });
    }

    function unitFactor() {
        return state.unit === "in" ? MM_PER_INCH : 1;
    }

    function unitLabel() {
        return state.unit === "in" ? "in" : "mm";
    }

    function dimDecimals() {
        return state.unit === "in" ? 3 : 2;
    }

    function fmtDim(mm) {
        return fmt(mm / unitFactor(), dimDecimals());
    }

    /* Dimension text for the drawing: the entered value with no trailing zeros,
       so an entered 25 reads "25" on the drawing instead of "25.00". */
    function dimText(mm) {
        var text = fmtDim(mm);
        if (text.indexOf(".") >= 0) {
            text = text.replace(/0+$/, "").replace(/\.$/, "");
        }
        return text;
    }

    function lenText(mm) {
        return fmtDim(mm) + " " + unitLabel();
    }

    function areaText(mm2) {
        return fmt(mm2 / 1e6, 4) + " m\u00b2";
    }

    function weightText(kg) {
        return fmt(kg, 2) + " kg";
    }

    function formatInput(mm) {
        var value = mm / unitFactor();
        var places = state.unit === "in" ? 4 : 3;
        return String(Number(value.toFixed(places)));
    }

    /* ==================================================
       SKETCH PRIMITIVES
       A drawing is a list of lines, polylines and texts.
       The same list is rendered to SVG on screen and to a
       SVG that is injected into the page.
    ================================================== */

    function sketch(width, height) {
        return { width: width, height: height, ops: [] };
    }

    function line(sk, x1, y1, x2, y2, kind) {
        sk.ops.push({ type: "line", x1: x1, y1: y1, x2: x2, y2: y2, kind: kind || "outline" });
    }

    function poly(sk, pts, kind, opts) {
        sk.ops.push({
            type: "poly",
            pts: pts,
            kind: kind || "outline",
            fill: !!(opts && opts.fill),
            solid: !!(opts && opts.solid),
            closed: !!(opts && opts.closed)
        });
    }

    function label(sk, x, y, str, opts) {
        var options = opts || {};
        sk.ops.push({
            type: "text",
            x: x,
            y: y,
            text: String(str),
            size: options.size || 11,
            anchor: options.anchor || "start",
            bold: !!options.bold,
            kind: options.kind || "dim"
        });
    }

    function arrow(sk, x, y, dx, dy, kind, sizeOverride) {
        var length = Math.hypot(dx, dy) || 1;
        var ux = dx / length;
        var uy = dy / length;
        var size = sizeOverride || 7.5;
        var half = size * 0.34;
        var bx = x - ux * size;
        var by = y - uy * size;
        var nx = -uy;
        var ny = ux;
        poly(sk, [
            [x, y],
            [bx + nx * half, by + ny * half],
            [bx - nx * half, by - ny * half]
        ], kind || "dim", { fill: true, solid: true, closed: true });
    }

    function dashAttribute(style) {
        if (!style.dash) {
            return "";
        }
        return ' stroke-dasharray="' + style.dash.join(" ") + '"';
    }

    function svgEscape(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function round2(value) {
        return Math.round(value * 100) / 100;
    }

    function sketchToSVG(sk) {
        var out = [];
        sk.ops.forEach(function (op) {
            var style = STYLE[op.kind] || STYLE.outline;
            if (op.type === "line") {
                out.push('<line x1="' + round2(op.x1) + '" y1="' + round2(op.y1) +
                    '" x2="' + round2(op.x2) + '" y2="' + round2(op.y2) +
                    '" stroke="' + style.stroke + '" stroke-width="' + style.width + '"' +
                    dashAttribute(style) + ' stroke-linecap="round"/>');
            } else if (op.type === "poly") {
                var d = op.pts.map(function (p, i) {
                    return (i ? "L" : "M") + round2(p[0]) + " " + round2(p[1]);
                }).join(" ");
                if (op.closed) {
                    d += " Z";
                }
                var fill = "none";
                if (op.fill) {
                    fill = op.solid ? style.stroke : MATERIAL_FILL;
                }
                out.push('<path d="' + d + '" fill="' + fill + '" stroke="' + style.stroke +
                    '" stroke-width="' + style.width + '"' + dashAttribute(style) +
                    ' stroke-linejoin="round"/>');
            } else if (op.type === "text") {
                out.push('<text x="' + round2(op.x) + '" y="' + round2(op.y) +
                    '" fill="' + TEXT_COLOR[op.kind] + '" text-anchor="' + op.anchor +
                    '" font-size="' + op.size + '" class="' + TEXT_CLASS[op.kind] + '"' +
                    (op.bold ? ' font-weight="700"' : "") + ">" + svgEscape(op.text) + "</text>");
            }
        });
        return out.join("");
    }

    /* Dimension helpers */

    function dimH(sk, x1, x2, y, text, fromY) {
        if (fromY !== undefined && fromY !== null) {
            line(sk, x1, fromY, x1, y + 6, "ext");
            line(sk, x2, fromY, x2, y + 6, "ext");
        }
        line(sk, x1, y, x2, y, "dim");
        arrow(sk, x1, y, -1, 0, "dim");
        arrow(sk, x2, y, 1, 0, "dim");
        label(sk, (x1 + x2) / 2, y - 6, text, { anchor: "middle", size: 11, kind: "dim" });
    }

    function dimV(sk, x, y1, y2, text, fromX, side) {
        var tick = side === "right" ? 6 : -6;
        if (fromX !== undefined && fromX !== null) {
            line(sk, fromX, y1, x + tick, y1, "ext");
            line(sk, fromX, y2, x + tick, y2, "ext");
        }
        line(sk, x, y1, x, y2, "dim");
        arrow(sk, x, y1, 0, -1, "dim");
        arrow(sk, x, y2, 0, 1, "dim");
        label(sk, x + (side === "right" ? 7 : -7), (y1 + y2) / 2 + 4, text, {
            anchor: side === "right" ? "start" : "end",
            size: 11,
            kind: "dim"
        });
    }

    function thicknessMark(sk, a, b, text, textX, textY, anchor) {
        line(sk, a[0], a[1], b[0], b[1], "dim");
        arrow(sk, a[0], a[1], a[0] - b[0], a[1] - b[1], "dim", 5);
        arrow(sk, b[0], b[1], b[0] - a[0], b[1] - a[1], "dim", 5);
        var mx = (a[0] + b[0]) / 2;
        var my = (a[1] + b[1]) / 2;
        line(sk, mx, my, textX, textY, "ext");
        label(sk, textX, textY - 4, text, { anchor: anchor || "start", size: 11, kind: "label" });
    }

    /* ==================================================
       GEOMETRY
    ================================================== */

    function torispherical(R, CR, KR) {
        var spread = CR - KR;
        var ratio = clamp((R - KR) / spread, 0, 1);
        var thetaC = Math.asin(ratio);
        var thetaK = Math.PI / 2 - thetaC;
        var H = CR - Math.sqrt(Math.max(0, spread * spread - (R - KR) * (R - KR)));
        var aKnuckle = 2 * Math.PI * KR * ((R - KR) * thetaK + KR * Math.sin(thetaK));
        var aCrown = 2 * Math.PI * CR * (H - KR * Math.sin(thetaK));
        return { thetaC: thetaC, thetaK: thetaK, H: H, aKnuckle: aKnuckle, aCrown: aCrown };
    }

    function ellipsoidDishArea(a, b) {
        if (Math.abs(a - b) < 1e-9) {
            return 2 * Math.PI * a * a;
        }
        if (a > b) {
            var e = Math.sqrt(1 - (b * b) / (a * a));
            return Math.PI * a * a + (Math.PI * b * b / (2 * e)) * Math.log((1 + e) / (1 - e));
        }
        var ep = Math.sqrt(1 - (a * a) / (b * b));
        return Math.PI * a * a + (Math.PI * a * b / ep) * Math.asin(ep);
    }

    /* Arc length of the meridian from the apex to parameter t (t = 0 apex, pi/2 rim). */
    function meridianArc(R, H, t) {
        var steps = 160;
        var sum = 0;
        var f = function (u) {
            return Math.hypot(R * Math.cos(u), H * Math.sin(u));
        };
        for (var i = 0; i < steps; i++) {
            var u0 = (t * i) / steps;
            var u1 = (t * (i + 1)) / steps;
            var um = (u0 + u1) / 2;
            sum += ((f(u0) + 4 * f(um) + f(u1)) * (u1 - u0)) / 6;
        }
        return sum;
    }

    /* Half profile of the inside surface: rim (R,0) to apex (0,H). */
    function halfProfile(type, R, H, KR, CR) {
        var pts = [];
        var n = 72;
        if (type === "flat") {
            /* Rim (R, 0) up the knuckle radius to the flat crown at y = KR. */
            var krF = clamp(KR, 1e-6, R * 0.98);
            for (var f = 0; f <= n; f++) {
                var qF = (Math.PI / 2) * (f / n);
                pts.push([(R - krF) + krF * Math.cos(qF), krF * Math.sin(qF)]);
            }
            pts.push([0, krF]);
            return pts;
        }
        if (type === "torispherical") {
            var g = torispherical(R, CR, KR);
            for (var i = 0; i <= n; i++) {
                var p = (g.thetaK * i) / n;
                pts.push([(R - KR) + KR * Math.cos(p), KR * Math.sin(p)]);
            }
            for (var j = 1; j <= n; j++) {
                var a = g.thetaC * (1 - j / n);
                pts.push([CR * Math.sin(a), H - CR + CR * Math.cos(a)]);
            }
            return pts;
        }
        for (var k = 0; k <= n * 2; k++) {
            var t = (Math.PI / 2) * (1 - k / (n * 2));
            pts.push([R * Math.sin(t), H * Math.cos(t)]);
        }
        return pts;
    }

    /* Inside surface from the bottom of the left flange, over the dome, to the right flange. */
    function insidePath(type, R, H, KR, CR, SF) {
        var right = halfProfile(type, R, H, KR, CR);
        var left = right.slice(0, -1).map(function (p) {
            return [-p[0], p[1]];
        });
        var profile = left.concat([[0, H]]).concat(right.slice(0, -1).reverse());
        return [[-R, -SF]].concat(profile).concat([[R, -SF]]);
    }

    /* Offset every point of a polyline along its outward normal. */
    function offsetProfile(pts, distance) {
        return pts.map(function (p, i) {
            var prev = pts[Math.max(0, i - 1)];
            var next = pts[Math.min(pts.length - 1, i + 1)];
            var dx = next[0] - prev[0];
            var dy = next[1] - prev[1];
            var len = Math.hypot(dx, dy) || 1;
            return [p[0] - (dy / len) * distance, p[1] + (dx / len) * distance];
        });
    }

    /* ==================================================
       OUTSIDE SURFACE ANCHORS
       Every section is drawn as the inside profile plus a wall thickness
       offset outwards, so the outside surface lies one wall further out along
       the normal of the inside surface. These helpers give the annotation code
       the point on that outside surface, so dimension arrows and extension
       lines always touch the outside boundary at any plate thickness instead
       of sinking into the wall.
    ================================================== */

    /* Point on the outside of a circle of radius r about [ox, oy]. */
    function outerCirclePoint(ox, oy, r, angle, wall) {
        var rr = r + wall;
        return [ox + rr * Math.cos(angle), oy + rr * Math.sin(angle)];
    }

    /* Point on the outside of the ellipse x squared / R squared +
       y squared / H squared = 1 that belongs to the inside point [x, y]. */
    function outerEllipsePoint(R, H, x, y, wall) {
        var nx = x / (R * R);
        var ny = y / (H * H);
        var len = Math.hypot(nx, ny) || 1;
        return [x + (nx / len) * wall, y + (ny / len) * wall];
    }

    /* ==================================================
       DRAWING LAYOUT CONSTANTS
       Every head type is drawn on one fixed 880 x 400 sheet. The coordinates
       below are drawing coordinates, not millimetres: entering a dimension
       changes the dimension text only, never the outline. The drawing
       therefore cannot grow, shrink, stretch or move while the fields are
       edited, on desktop and on mobile alike.
    ================================================== */

    var SHEET = {
        width: 880,
        height: 400,
        cx: 440,
        radius: 200,
        face: 46,
        wall: 6,
        /* Vertical band the section is centred in, below the drawing title. */
        band: { top: 40, bottom: 392 }
    };

    /* Fixed schematic profile of each head type, in drawing units. */
    var PROFILE = {
        flat: { kr: 50, h: 50 },
        torispherical: { kr: 40, cr: 400 },
        ellipsoidal: { h: 100 },
        hemispherical: { h: 200 }
    };

    /* True when a number was actually entered. */
    function entered(value) {
        return typeof value === "number" && isFinite(value);
    }

    function positive(value) {
        return entered(value) && value > 0;
    }

    /* "ID = 1,000" once the value is entered, plain "ID" while the field is
       still empty: the drawing never shows a dimension nobody entered. */
    function dimLabel(symbol, value) {
        return positive(value) || value === 0
            ? symbol + " = " + dimText(value)
            : symbol;
    }

    /* Crown height of the selected type, taken from the entered dimensions.
       null means "not entered yet", so the label stays a plain symbol. */
    function crownHeight(type, dims) {
        if (type === "flat") {
            return positive(dims.kr) ? dims.kr : null;
        }
        if (type === "torispherical") {
            return positive(dims.id) && positive(dims.kr)
                ? torispherical(dims.id / 2, dims.id, dims.kr).H
                : null;
        }
        if (type === "hemispherical") {
            return positive(dims.id) ? dims.id / 2 : null;
        }
        return positive(dims.h) ? dims.h : null;
    }

    /* Radius shown on the drawing: knuckle radius, inside radius or the crown
       radius of curvature R = a squared divided by b. */
    function radiusValue(type, dims) {
        if (type === "flat" || type === "torispherical") {
            return positive(dims.kr) ? dims.kr : null;
        }
        if (type === "hemispherical") {
            return positive(dims.id) ? dims.id / 2 : null;
        }
        return positive(dims.id) && positive(dims.h)
            ? (dims.id * dims.id) / (4 * dims.h)
            : null;
    }

    /* ==================================================
       HEAD DRAWING (FOUR SECTION TYPES)
    ================================================== */

    function headSketch(type, dims, unit) {
        var sk = sketch(SHEET.width, SHEET.height);
        var cx = SHEET.cx;
        var Rpx = SHEET.radius;
        var facePx = SHEET.face;
        var wallPx = SHEET.wall;

        var Hpx;
        var KRpx = 0;
        var CRpx = 0;
        var inside;

        if (type === "flat") {
            KRpx = PROFILE.flat.kr;
            Hpx = PROFILE.flat.h;
            inside = insidePath("flat", Rpx, Hpx, KRpx, 0, facePx);
        } else if (type === "torispherical") {
            KRpx = PROFILE.torispherical.kr;
            CRpx = PROFILE.torispherical.cr;
            Hpx = torispherical(Rpx, CRpx, KRpx).H;
            inside = insidePath("torispherical", Rpx, Hpx, KRpx, CRpx, facePx);
        } else if (type === "hemispherical") {
            Hpx = PROFILE.hemispherical.h;
            inside = insidePath("hemispherical", Rpx, Hpx, 0, 0, facePx);
        } else {
            Hpx = PROFILE.ellipsoidal.h;
            inside = insidePath("ellipsoidal", Rpx, Hpx, 0, 0, facePx);
        }

        /* The section is centred on the sheet for the selected type, so a
           shallow flat head does not float at the bottom of the frame. The
           offset is computed from the type alone - never from the entered
           values - and the flange band keeps its space even when SF is zero,
           so typing a dimension can never move the drawing. */
        var bandTop = SHEET.band.top;
        var bandBottom = SHEET.band.bottom;
        var groupH = Hpx + facePx + 50;
        var rimY = bandTop + Math.max(0, (bandBottom - bandTop - groupH) / 2) + Hpx;
        var idY = rimY + facePx + 30;
        var noteY = idY + 20;

        /* A straight face of exactly zero means no flange: the flange band is
           left out while the dimension lines keep their fixed places. */
        var flangeDrawn = dims.sf !== 0;
        if (!flangeDrawn) {
            inside = insidePath(type, Rpx, Hpx, KRpx, CRpx, 0);
        }

        var outside = offsetProfile(inside, wallPx);
        var apexY = rimY - Hpx;
        var bottomY = rimY + (flangeDrawn ? facePx : 0);
        var xL = cx - Rpx;
        var xR = cx + Rpx;

        /* Anchors on the outside surface, read from the plate outline itself:
           its widest points and its crown. Dimensions that describe the
           outside of the plate hang off these, never off the inner boundary,
           so an extension line never runs through the wall thickness. */
        var outerL = cx + Math.min.apply(null, outside.map(function (p) { return p[0]; }));
        var outerR = cx + Math.max.apply(null, outside.map(function (p) { return p[0]; }));
        var outerApexY = rimY - Math.max.apply(null, outside.map(function (p) { return p[1]; }));

        function toPx(p) {
            return [cx + p[0], rimY - p[1]];
        }

        poly(sk, inside.concat(outside.slice().reverse()).map(toPx), "outline",
            { fill: true, closed: true });

        /* Centreline and the tangent (rim) reference line */
        line(sk, cx, apexY - 30, cx, bottomY + 18, "centre");
        line(sk, xL - 46, rimY, xR + 46, rimY, "ref");

        /* ID: inside diameter, below the profile on a fixed line */
        dimH(sk, xL, xR, idY, dimLabel("ID", dims.id), bottomY);

        /* SF: straight flange, measured on the outside face of the left flange */
        if (flangeDrawn) {
            dimV(sk, outerL - 34, rimY, bottomY, dimLabel("SF", dims.sf), outerL, "left");
        }

        /* H: crown height, from the outside crown down to the tangent line */
        var hx = xR + 46;
        /* A flat crown is a face rather than a single apex, so its extension
           line starts just past the right end of that face and never runs
           along the crown outline; a dished profile tapers to one apex. */
        var crownStartX = type === "flat"
            ? cx + (Rpx - KRpx) + wallPx
            : cx;
        line(sk, crownStartX, outerApexY, hx + 6, outerApexY, "ext");
        line(sk, outerR, rimY, hx + 6, rimY, "ext");
        line(sk, hx, outerApexY, hx, rimY, "dim");
        arrow(sk, hx, outerApexY, 0, -1, "dim", 7);
        arrow(sk, hx, rimY, 0, 1, "dim", 7);
        label(sk, hx + 7, (outerApexY + rimY) / 2 + 4, dimLabel("H", crownHeight(type, dims)), {
            anchor: "start", size: 11, kind: "dim"
        });

        /* R: radius callout. Knuckle radius on the flat and torispherical
           heads, inside radius on the hemisphere, crown radius of curvature
           on the elliptical profile. */
        var rValue = radiusValue(type, dims);

        if (type === "flat" || type === "torispherical") {
            var knuckleAngle = type === "flat"
                ? Math.PI * 0.26
                : torispherical(Rpx, CRpx, KRpx).thetaK * 0.42;
            /* The leader lands on the outside of the knuckle: its outside
               surface is the same centre with a radius KR + wall. */
            var arcPt = toPx(outerCirclePoint(
                -(Rpx - KRpx), 0, KRpx, Math.PI - knuckleAngle, wallPx
            ));
            var leadX = arcPt[0] - 24;
            var leadY = arcPt[1] - 30;
            line(sk, leadX, leadY + 5, arcPt[0], arcPt[1], "dim");
            arrow(sk, arcPt[0], arcPt[1],
                arcPt[0] - leadX, arcPt[1] - leadY - 5, "dim", 5.5);
            label(sk, leadX - 3, leadY, dimLabel("R", rValue), {
                anchor: "end", size: 11, kind: "label"
            });
        } else if (type === "hemispherical") {
            var angle = Math.PI * 0.28;
            /* Screen y grows downwards, so the angle is mirrored on the sheet. */
            var arcPoint = outerCirclePoint(cx, rimY, Rpx, -angle, wallPx);
            var tailX = cx + (Rpx + 34) * Math.cos(angle);
            var tailY = rimY - (Rpx + 34) * Math.sin(angle);
            line(sk, cx, rimY, tailX, tailY, "dim");
            arrow(sk, arcPoint[0], arcPoint[1], arcPoint[0] - cx, arcPoint[1] - rimY, "dim");
            label(sk, tailX + 7, tailY + 4, dimLabel("R", rValue), {
                anchor: "start", size: 11, kind: "label"
            });
        } else {
            var crownT = Math.PI * 0.2;
            var crownPt = toPx(outerEllipsePoint(
                Rpx, Hpx, -Rpx * Math.sin(crownT), Hpx * Math.cos(crownT), wallPx
            ));
            var crownLeadX = crownPt[0] - 28;
            var crownLeadY = crownPt[1] - 32;
            line(sk, crownLeadX, crownLeadY + 5, crownPt[0], crownPt[1], "dim");
            arrow(sk, crownPt[0], crownPt[1],
                crownPt[0] - crownLeadX, crownPt[1] - crownLeadY - 5, "dim", 5.5);
            label(sk, crownLeadX - 3, crownLeadY, dimLabel("R", rValue), {
                anchor: "end", size: 11, kind: "label"
            });
        }

        textHeader(sk, TYPE_INFO[type], unit);
        label(sk, 24, noteY,
            "Schematic drawing \u00b7 labels follow the dimensions you enter \u00b7 not to scale",
            { size: 9.5, kind: "note" });
        return sk;
    }

    function textHeader(sk, info, unit) {
        label(sk, 24, 26, info.drawingTitle, { size: 12.5, kind: "title" });
        label(sk, 856, 26, "ALL DIMENSIONS IN " + (unit === "in" ? "INCHES" : "MM"),
            { size: 10, anchor: "end", kind: "note" });
    }

    /* ==================================================
       TEMPLATE DRAWING (ELLIPTICAL HEAD TEMPLATE)
    ================================================== */

    function buildStations(R, H, n, blankR) {
        var step = (2 * Math.PI) / n;
        var rows = [];
        for (var i = 0; i <= n / 2; i++) {
            var phi = i * step;
            var x = R * Math.cos(phi);
            var r = Math.abs(x);
            var t = Math.asin(clamp(r / R, 0, 1));
            rows.push({
                index: i,
                angle: (phi * 180) / Math.PI,
                planRadius: r,
                height: H * Math.cos(t),
                meridian: meridianArc(R, H, t),
                bx: blankR * Math.sin(phi),
                by: blankR * Math.cos(phi)
            });
        }
        return rows;
    }

    /* Front view of an elliptical dished head: inside and outside walls, the
       dashed tangent reference line, the mirror centreline and the development
       division lines. The on-screen template view calls this helper, so its
       geometry stays in one place even if the drawing is changed later. */
    function drawEllipticalFront(sk, geom, options) {
        var opts = options || {};
        var cx = geom.cx;
        var rimY = geom.rimY;
        var R = geom.R;
        var H = geom.H;
        var face = geom.face;
        var wall = geom.wall;
        var divisions = geom.divisions || 24;
        var refPad = opts.refPad === undefined ? 40 : opts.refPad;
        var centreUp = opts.centreUp === undefined ? 30 : opts.centreUp;
        var centreDown = opts.centreDown === undefined ? 32 : opts.centreDown;

        function toPx(p) {
            return [cx + p[0], rimY - p[1]];
        }

        var inside = insidePath("ellipsoidal", R, H, 0, 0, face);
        var outside = offsetProfile(inside, wall);
        poly(sk, inside.concat(outside.slice().reverse()).map(toPx), "outline",
            { fill: true, closed: true });

        /* Mirrored station lines: x = R cos(phi), height = H sin(phi). */
        for (var i = 1; i < divisions / 2; i++) {
            var phi = (2 * Math.PI * i) / divisions;
            var dx = R * Math.cos(phi);
            var dy = H * Math.abs(Math.sin(phi));
            line(sk, cx + dx, rimY, cx + dx, rimY - dy, "dev");
            line(sk, cx - dx, rimY, cx - dx, rimY - dy, "dev");
        }

        line(sk, cx, rimY - H - centreUp, cx, rimY + face + centreDown, "centre");
        line(sk, cx - R - refPad, rimY, cx + R + refPad, rimY, "ref");
    }

    function templateSketch(dims, unit) {
        var sk = sketch(880, 400);
        var N = dims.divisions;
        var Rreal = positive(dims.id) ? dims.id / 2 : null;
        var Hreal = positive(dims.h) ? dims.h : null;
        var SFreal = entered(dims.sf) && dims.sf >= 0 ? dims.sf : null;
        var areaTotal = Rreal !== null && Hreal !== null
            ? ellipsoidDishArea(Rreal, Hreal) + 2 * Math.PI * Rreal * (SFreal || 0)
            : null;
        var blankDia = areaTotal !== null ? 2 * Math.sqrt(areaTotal / Math.PI) : null;
        var stations = Rreal !== null && Hreal !== null
            ? buildStations(Rreal, Hreal, N, blankDia / 2)
            : null;

        /* Left panel: half section with the radial division lines. The panel
           has fixed drawing coordinates, so the section never resizes. */
        var cx1 = 236;
        var rimY1 = 292;
        var R1 = 124;
        var H1 = 62;
        var face1 = 34;
        var wall1 = 6;
        var apexY1 = rimY1 - H1;
        var bottomY1 = rimY1 + face1;
        var xL1 = cx1 - R1;
        var xR1 = cx1 + R1;

        /* Outside-surface anchors of this panel: the flange faces and the
           crown of the plate, one wall thickness outside the inner profile. */
        var outerL1 = xL1 - wall1;
        var outerR1 = xR1 + wall1;
        var outerApexY1 = apexY1 - wall1;

        drawEllipticalFront(sk, {
            cx: cx1,
            rimY: rimY1,
            R: R1,
            H: H1,
            face: face1,
            wall: wall1,
            divisions: N
        }, { refPad: 40, centreUp: 30, centreDown: 32 });

        label(sk, cx1 + 8, apexY1 - 32, "MIRROR LINE", { size: 9, kind: "note" });

        dimH(sk, xL1, xR1, bottomY1 + 26, dimLabel("ID", dims.id), bottomY1);

        var hx1 = xR1 + 34;
        line(sk, cx1, outerApexY1, hx1 + 6, outerApexY1, "ext");
        line(sk, outerR1, rimY1, hx1 + 6, rimY1, "ext");
        line(sk, hx1, outerApexY1, hx1, rimY1, "dim");
        arrow(sk, hx1, outerApexY1, 0, -1, "dim", 5);
        arrow(sk, hx1, rimY1, 0, 1, "dim", 5);
        label(sk, hx1 + 7, (outerApexY1 + rimY1) / 2 + 4, dimLabel("H", Hreal), {
            anchor: "start", size: 11, kind: "dim"
        });

        /* SF: straight flange of the section */
        var sfX = xL1 - 20;
        line(sk, outerL1, rimY1, sfX - 6, rimY1, "ext");
        line(sk, outerL1, bottomY1, sfX - 6, bottomY1, "ext");
        line(sk, sfX, rimY1, sfX, bottomY1, "dim");
        arrow(sk, sfX, rimY1, 0, -1, "dim", 5);
        arrow(sk, sfX, bottomY1, 0, 1, "dim", 5);
        label(sk, sfX - 4, rimY1 - 8, dimLabel("SF", SFreal), {
            anchor: "end", size: 11, kind: "dim"
        });

        /* R: crown radius of curvature at the apex, R = a squared divided by b */
        var crownR = Rreal !== null && Hreal !== null ? (Rreal * Rreal) / Hreal : null;
        var crownT1 = Math.PI * 0.2;
        var crownOut1 = outerEllipsePoint(
            R1, H1, -R1 * Math.sin(crownT1), H1 * Math.cos(crownT1), wall1
        );
        var crownPt1 = [cx1 + crownOut1[0], rimY1 - crownOut1[1]];
        line(sk, crownPt1[0] - 26, crownPt1[1] - 28, crownPt1[0], crownPt1[1], "dim");
        arrow(sk, crownPt1[0], crownPt1[1], 26, 23, "dim", 5);
        label(sk, crownPt1[0] - 30, crownPt1[1] - 32, dimLabel("R", crownR), {
            anchor: "end", size: 11, kind: "label"
        });

        label(sk, 24, 54, "HALF SECTION", { size: 10.5, kind: "note" });
        label(sk, 24, 74, N + " equal divisions at " + fmt(360 / N, 2) + "\u00b0", {
            size: 10, kind: "note"
        });

        /* Right panel: developed blank with the radial layout lines, also on
           fixed coordinates so the blank keeps its place and size. */
        var bx = 646;
        var by = 194;
        var rMax = 112;
        var circle = [];
        for (var c = 0; c <= 120; c++) {
            var a = (2 * Math.PI * c) / 120;
            circle.push([bx + rMax * Math.cos(a), by + rMax * Math.sin(a)]);
        }
        poly(sk, circle, "outline", { closed: true });

        for (var d = 0; d < N; d++) {
            var angle = (2 * Math.PI * d) / N - Math.PI / 2;
            line(sk, bx, by, bx + rMax * Math.cos(angle), by + rMax * Math.sin(angle), "dev");
        }

        line(sk, bx - 10, by, bx + 10, by, "centre");
        line(sk, bx, by - 10, bx, by + 10, "centre");

        dimH(sk, bx - rMax, bx + rMax, by + rMax + 30,
            "BLANK \u00d8" + (blankDia !== null ? " = " + dimText(blankDia) : ""),
            by + rMax);

        label(sk, 512, 54, "DEVELOPED BLANK", { size: 11.5, kind: "title" });
        label(sk, 512, 74, "Area-equivalent \u00b7 " + N + " radial lines", { size: 10, kind: "note" });
        line(sk, 500, 92, 500, 356, "ref");

        textHeader(sk, TYPE_INFO.template, unit);
        label(sk, 30, 386,
            "Schematic drawing \u00b7 labels follow the dimensions you enter \u00b7 not to scale",
            { size: 9.5, kind: "note" });

        sk.meta = {
            blankDia: blankDia,
            areaTotal: areaTotal,
            stations: stations,
            divisions: N,
            id: dims.id,
            h: Hreal,
            sf: SFreal,
            t: positive(dims.t) ? dims.t : null
        };
        return sk;
    }

    /* ==================================================
       CALCULATION
    ================================================== */

    /* ==================================================
       VALIDATION
    ================================================== */

    function readInput() {
        var type = state.type;
        var mm = state.mm;
        var density = Number(dom.density.value);
        var quantity = Number(dom.quantity.value);
        var id = mm.id;
        var R = id ? id / 2 : 0;
        var sf = mm.sf === null || mm.sf === undefined ? 0 : mm.sf;
        var t = mm.t;
        var material = MATERIALS[state.material] ? MATERIALS[state.material].name : "Custom Material";

        if (!(id > 0) || !Number.isFinite(id)) {
            return fail("Enter the dish inside diameter (ID).", "id");
        }
        if (!(t > 0) || !Number.isFinite(t)) {
            return fail("Enter the dish thickness (T).", "t");
        }
        if (t >= R) {
            return fail("Thickness must be smaller than the inside radius (ID \u00f7 2 = " +
                lenText(R) + ").", "t");
        }
        if (!(sf >= 0) || !Number.isFinite(sf)) {
            return fail("Straight face must be zero or a positive number.", "sf");
        }

        if (type === "flat") {
            var krFlat = mm.kr;
            if (!(krFlat > 0) || !Number.isFinite(krFlat)) {
                return fail("Enter the dish knuckle radius (R).", "kr");
            }
            if (krFlat >= R) {
                return fail("Knuckle radius must be smaller than the inside radius (ID \u00f7 2 = " +
                    lenText(R) + ").", "kr");
            }
        }

        if (type === "torispherical") {
            var kr = mm.kr;
            if (!(kr > 0) || !Number.isFinite(kr)) {
                return fail("Enter the dish knuckle radius (R).", "kr");
            }
            if (kr >= R) {
                return fail("Knuckle radius must be smaller than the inside radius (ID \u00f7 2 = " +
                    lenText(R) + ").", "kr");
            }
        }

        if (type === "ellipsoidal" || type === "template") {
            var h = mm.h;
            if (!(h > 0) || !Number.isFinite(h)) {
                return fail("Enter the dish total height (H).", "h");
            }
            if (h > id) {
                return fail("Dish height must not exceed the inside diameter (ID = " +
                    lenText(id) + ").", "h");
            }
        }

        if (!(density > 0) || !Number.isFinite(density)) {
            return fail("Enter a valid material density in kg/m\u00b3.", "density");
        }
        if (density > 25000) {
            return fail("Density looks too high; enter the density in kg/m\u00b3 (for example 7850).", "density");
        }
        if (!Number.isInteger(quantity) || quantity < 1) {
            return fail("Quantity must be a whole number of at least 1.", "quantity");
        }

        return {
            ok: true,
            value: {
                id: id,
                sf: sf,
                t: t,
                kr: mm.kr || 0,
                h: mm.h || 0,
                density: density,
                quantity: quantity,
                divisions: state.divisions,
                materialName: material
            }
        };
    }

    function fail(message, field) {
        return { ok: false, message: message, field: field };
    }

    /* ==================================================
       RESULT RENDERING
    ================================================== */

    function statHtml(rows) {
        return rows.map(function (row) {
            return '<div class="stat"><span>' + row[0] + "</span><strong>" + row[1] + "</strong></div>";
        }).join("");
    }

    function renderResult(result) {
        dom.totalWeight.textContent = weightText(result.totalWeight);
        dom.tonnes.textContent = fmt(result.totalWeight / 1000, 3) + " tonnes total \u00b7 " +
            result.quantity + (result.quantity === 1 ? " piece" : " pieces");

        var geo = [];
        geo.push(["Inside Diameter (ID)", lenText(result.id)]);
        geo.push(["Inside Radius (R)", lenText(result.R)]);

        if (result.kind === "flat") {
            geo.push(["Knuckle Radius (R)", lenText(result.KR)]);
            geo.push(["Crown Height (H = R)", lenText(result.KR)]);
            geo.push(["Flat Crown Diameter (ID \u2212 2R)", lenText(result.id - 2 * result.KR)]);
            geo.push(["Profile", "Flanged flat head (crown + knuckle + flange)"]);
        } else if (result.kind === "torispherical") {
            geo.push(["Crown Radius (C.R)", lenText(result.CR)]);
            geo.push(["Knuckle Radius (R)", lenText(result.KR)]);
            geo.push(["Dish Height (H)", lenText(result.H)]);
            geo.push(["Crown Arc Angle", fmt((result.thetaC * 180) / Math.PI, 2) + "\u00b0"]);
            geo.push(["Knuckle Arc Angle", fmt((result.thetaK * 180) / Math.PI, 2) + "\u00b0"]);
        } else if (result.kind === "hemispherical") {
            geo.push(["Dish Height (H = R)", lenText(result.H)]);
        } else {
            geo.push(["Dish Height (H)", lenText(result.H)]);
            geo.push(["D \u00f7 2H Ratio", fmt(result.id / (2 * result.H), 3)]);
        }

        geo.push(["Dish Surface Area", areaText(result.dishArea)]);
        geo.push(["Straight Face Area", areaText(result.faceArea)]);
        geo.push(["Total Developed Area", areaText(result.areaTotal)]);

        var dev = [];
        dev.push(["Meridian Length (Apex to Rim)", lenText(result.meridian)]);
        dev.push(["Developed Blank \u00d8", lenText(result.blankDia)]);
        dev.push(["Blank Area", areaText(result.blankArea)]);

        if (result.kind === "template") {
            dev.push(["Development Divisions", String(result.divisions)]);
            dev.push(["Angular Step", fmt(result.stepDeg, 2) + "\u00b0"]);
            dev.push(["Stations in Half Drawing", String(result.divisions / 2 + 1)]);
        }

        var mat = [];
        mat.push(["Material", result.materialName]);
        mat.push(["Material Density", fmt(result.density, 0) + " kg/m\u00b3"]);
        mat.push(["Plate Thickness (T)", lenText(result.T)]);
        mat.push(["Material Volume (A \u00d7 T)", fmt((result.areaTotal * result.T) / 1e9, 4) + " m\u00b3"]);
        mat.push(["Estimated Weight per Piece", weightText(result.weight)]);
        mat.push(["Total Quantity", result.quantity + (result.quantity === 1 ? " pc" : " pcs")]);
        mat.push(["Total Estimated Weight", weightText(result.totalWeight)]);
        mat.push(["Total Developed Area", areaText(result.areaTotal * result.quantity)]);

        dom.geoRows.innerHTML = statHtml(geo);
        dom.devRows.innerHTML = statHtml(dev);
        dom.matRows.innerHTML = statHtml(mat);

        if (result.kind === "template" && result.stations) {
            var rows = result.stations.map(function (station) {
                return "<tr><td>" + station.index + "</td>" +
                    "<td>" + fmt(station.angle, 2) + "</td>" +
                    "<td>" + fmtDim(station.planRadius) + "</td>" +
                    "<td>" + fmtDim(station.height) + "</td>" +
                    "<td>" + fmtDim(station.meridian) + "</td>" +
                    "<td>" + fmtDim(station.bx) + "</td>" +
                    "<td>" + fmtDim(station.by) + "</td></tr>";
            }).join("");
            dom.coordBody.innerHTML = rows;
            dom.coordWrap.hidden = false;
            dom.coordNote.textContent = "Blank X and Y are measured from the blank centre, in " +
                unitLabel() + ". Stations are numbered from the +X side of the half drawing; " +
                "the full head has " + result.divisions + " divisions.";
        } else {
            dom.coordWrap.hidden = true;
            dom.coordBody.innerHTML = "";
        }

        dom.resultNote.textContent = TYPE_INFO[result.kind].resultNote + " " +
            (result.kind === "template"
                ? "Theoretical weight uses the developed surface area at the inside dimensions. " +
                  "The blank is the area-equivalent plate; a shop forming and trim allowance must be added."
                : "Theoretical weight uses the developed surface area at the inside dimensions and the " +
                  "nominal plate thickness. Forming thinning, mill tolerance, weld prep, openings and " +
                  "trimming allowance are not included.");

        dom.results.classList.add("is-visible");
    }

    function hideResults() {
        dom.results.classList.remove("is-visible");
        state.hasResult = false;
        state.last = null;
    }

    /* ==================================================
       DRAWING UPDATE
    ================================================== */

    function draw() {
        if (!state.type) {
            return;
        }
        /* The drawing only reads the entered values: nothing is invented, so an
           empty field shows a plain symbol instead of a made-up dimension. */
        var dims = {
            id: state.mm.id,
            kr: state.mm.kr,
            sf: state.mm.sf,
            h: state.mm.h,
            t: state.mm.t,
            divisions: state.divisions
        };
        var sk = state.type === "template"
            ? templateSketch(dims, state.unit)
            : headSketch(state.type, dims, state.unit);

        dom.dishDrawing.innerHTML = sketchToSVG(sk);

        /* Crop the sheet to the drawing's own content. The outline keeps its
           fixed coordinates, but a shallow head no longer carries the empty
           lower band of the full-height sheet. */
        var bounds = dom.dishDrawing.getBBox();
        var viewHeight = bounds.height > 0
            ? Math.min(SHEET.height, Math.ceil(bounds.y + bounds.height + 10))
            : SHEET.height;

        dom.dishFigure.setAttribute("viewBox", "0 0 " + SHEET.width + " " + viewHeight);
    }

    /* ==================================================
       FIELDS
    ================================================== */

    function fieldHtml(key, enterHint) {
        var meta = FIELD_META[key];
        var value = state.mm[key] === null || state.mm[key] === undefined
            ? ""
            : formatInput(state.mm[key]);
        var placeholder = PLACEHOLDERS[state.unit][key];

        return '<div>' +
            '<label for="field-' + key + '">' + meta.label + " (" + meta.notation + ")</label>" +
            '<input type="number" id="field-' + key + '" data-field="' + key +
            '" min="0" step="any" inputmode="decimal" enterkeyhint="' + enterHint + '" autocomplete="off" ' +
            'placeholder="' + placeholder + '" value="' + value + '">' +
            "</div>";
    }

    function renderFields() {
        if (!state.type) {
            dom.fieldGrid.innerHTML = "";
            return;
        }
        var fields = TYPE_FIELDS[state.type];
        var html = "";

        fields.forEach(function (key, index) {
            html += fieldHtml(key, index === fields.length - 1 ? "done" : "next");
            if (state.type === "hemispherical" && key === "id") {
                html += '<div>' +
                    '<label for="derivedR">Radius (R) &mdash; calculated</label>' +
                    '<output class="derived-output" id="derivedR">' +
                    (state.mm.id > 0 ? lenText(state.mm.id / 2) : "\u2014") +
                    "</output></div>";
            }
        });

        dom.fieldGrid.innerHTML = html;
        updateDerived();
    }

    function updateDerived() {
        var output = $("derivedR");
        if (!output) {
            return;
        }
        output.textContent = state.mm.id > 0 ? lenText(state.mm.id / 2) : "\u2014";
    }

    function syncFieldValues() {
        if (!state.type) {
            return;
        }
        TYPE_FIELDS[state.type].forEach(function (key) {
            var input = $("field-" + key);
            if (input) {
                input.value = state.mm[key] === null || state.mm[key] === undefined
                    ? ""
                    : formatInput(state.mm[key]);
            }
        });
        updateDerived();
    }

    /* The control a validation message is about. */
    function fieldInput(field) {
        return field === "density" ? dom.density
            : field === "quantity" ? dom.quantity
            : $("field-" + field);
    }

    function focusField(field) {
        var input = fieldInput(field);
        if (input) {
            input.focus();
            if (input.select) {
                input.select();
            }
        }
    }

    function showError(message) {
        dom.error.textContent = message;
    }

    function clearError() {
        dom.error.textContent = "";
        Array.prototype.forEach.call(
            document.querySelectorAll("[aria-invalid]"),
            function (element) {
                element.removeAttribute("aria-invalid");
            }
        );
    }

    /* Point assistive technology at the field the message is about. */
    function markInvalid(field) {
        var input = fieldInput(field);
        if (input) {
            input.setAttribute("aria-invalid", "true");
        }
    }

    /* ==================================================
       ACTIONS
    ================================================== */

    async function calculate(options) {
        if (!state.type) {
            return false;
        }
        var silent = options && options.silent;
        var token = ++state.calcToken;
        var input = readInput();

        if (!input.ok) {
            /* Live recalculation still reports why the result disappeared,
               but only an explicit Calculate steals the focus. */
            showError(input.message);
            markInvalid(input.field);
            if (!silent) {
                focusField(input.field);
            }
            return false;
        }

        clearError();

        var result;

        try {
            result = await MWCalc.calculate("dish-ends", {
                type: state.type,
                values: {
                    id: input.value.id,
                    kr: input.value.kr,
                    h: input.value.h,
                    sf: input.value.sf,
                    t: input.value.t
                },
                /* readInput() already converted every value to millimetres. */
                unit: "mm",
                density: input.value.density,
                quantity: input.value.quantity,
                divisions: input.value.divisions,
                materialName: input.value.materialName
            });
        } catch (error) {
            if (token !== state.calcToken) {
                return true;
            }
            showError(error.message || "Calculation service is unavailable.");
            hideResults();
            return false;
        }

        /* A newer run has started while this one was in flight; the newer
           response owns the result panel. */
        if (token !== state.calcToken) {
            return true;
        }

        state.last = result;
        state.hasResult = true;
        state.autoCalc = true;
        renderResult(result);

        if (!silent && window.innerWidth < 720) {
            dom.results.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return true;
    }

    /* The calculator cards (drawing and fields, material, actions, results
       formula and questions) exist only while a type is selected. */
    function setCalculatorVisible(visible) {
        [dom.dimensionsCard, dom.materialCard, dom.actionsBar,
            dom.methodCard, dom.faqCard].forEach(function (card) {
            if (card) {
                card.hidden = !visible;
            }
        });
    }

    /* The single place that decides which dish end type is open: the
       dropdown, the fields, the drawing, the formula and the results all
       follow it. Called with null (or an unknown value) it returns the page to
       the "choose a type" state. */
    function selectType(type) {
        var valid = !!TYPE_INFO[type];

        if (valid && type === state.type) {
            return;
        }

        state.type = valid ? type : null;
        state.mm = valid ? typeValues(type) : blankValues();
        /* A calculation still in flight belongs to the type that was open; its
           response must not land in the newly opened type's panel. */
        state.calcToken += 1;

        if (dom.designType) {
            dom.designType.value = valid ? type : "";
        }

        setCalculatorVisible(valid);
        dom.pageTitle.textContent = valid ? TYPE_INFO[type].title : BASE_TITLE;
        document.title = valid
            ? TYPE_INFO[type].title + " | Metal Weight Calculator"
            : BASE_TITLE + " | Metal Weight Calculator";
        clearError();
        hideResults();
        /* A different type needs its own calculation before it goes live. */
        state.autoCalc = false;

        if (!valid) {
            dom.fieldGrid.innerHTML = "";
            dom.dishDrawing.innerHTML = "";
            dom.dishFigure.setAttribute("viewBox", "0 0 " + SHEET.width + " " + SHEET.height);
            return;
        }

        renderFields();
        dom.divisionBlock.hidden = type !== "template";
        dom.drawingAlt.textContent = TYPE_INFO[type].drawingAlt;
        dom.methodEquation.innerHTML = TYPE_INFO[type].equation;
        dom.methodLegend.innerHTML = TYPE_INFO[type].variables;
        dom.methodBody.innerHTML =
            TYPE_INFO[type].method +
            '<p class="small-text" style="margin-top:0;"><strong>Variables:</strong> ' +
            TYPE_INFO[type].variables + '</p>' +
            '<p class="small-text"><strong>Assumptions/limitations:</strong> Constant thickness, ' +
            'inside-surface dimensions, no forming thinning, mill tolerance, weld bevels, openings ' +
            'or trimming allowance.</p>';
        renderExample(type);
        renderFaqs(type);
        draw();
    }

    function setUnit(unit) {
        if (unit !== "mm" && unit !== "in") {
            return;
        }
        state.unit = unit;

        dom.mmBtn.classList.toggle("active", unit === "mm");
        dom.mmBtn.setAttribute("aria-pressed", unit === "mm" ? "true" : "false");
        dom.inchBtn.classList.toggle("active", unit === "in");
        dom.inchBtn.setAttribute("aria-pressed", unit === "in" ? "true" : "false");
        dom.unitNote.textContent = UNIT_NOTE[unit];

        renderFields();
        draw();

        if (state.hasResult) {
            calculate({ silent: true }).then(function (ok) {
                if (!ok) {
                    hideResults();
                }
            });
        }
    }

    function setDivisions(value) {
        var next = Number(value);
        if (DIVISIONS.indexOf(next) === -1) {
            return;
        }
        state.divisions = next;
        dom.divisionGrid.querySelectorAll(".division-btn").forEach(function (button) {
            button.setAttribute("aria-pressed",
                Number(button.dataset.divisions) === next ? "true" : "false");
        });
        draw();
        if (state.hasResult) {
            calculate({ silent: true }).then(function (ok) {
                if (!ok) {
                    hideResults();
                }
            });
        }
    }

    function syncDivisions() {
        dom.divisionGrid.querySelectorAll(".division-btn").forEach(function (button) {
            button.setAttribute("aria-pressed",
                Number(button.dataset.divisions) === state.divisions ? "true" : "false");
        });
    }

    function applyMaterial(key) {
        state.material = key;
        state.densityEdited = false;
        var material = MATERIALS[key];
        dom.material.value = key;

        if (material && material.density !== null) {
            dom.density.value = String(material.density);
            dom.densityNote.textContent = material.name + " density " + fmt(material.density, 0) +
                " kg/m\u00b3 is used. You can type any density for another grade.";
        } else {
            dom.density.value = "";
            dom.densityNote.textContent = "Enter the density of the material you are using, in kg/m\u00b3.";
        }
        /* A material change replaces the density with that material's value,
           so any earlier manual edit no longer counts as user-edited. */
        dom.density.removeAttribute("data-user-edited");
    }

    function resetAll() {
        /* Every type's saved values are cleared, so nothing typed for one
           profile can reappear when another one is opened. */
        state.byType = {};
        state.mm = state.type ? typeValues(state.type) : blankValues();
        state.divisions = 24;
        state.quantity = 1;
        state.unit = "mm";
        state.densityEdited = false;

        dom.mmBtn.classList.add("active");
        dom.mmBtn.setAttribute("aria-pressed", "true");
        dom.inchBtn.classList.remove("active");
        dom.inchBtn.setAttribute("aria-pressed", "false");
        dom.unitNote.textContent = UNIT_NOTE.mm;
        dom.quantity.value = "1";

        applyMaterial("carbon-steel");
        syncDivisions();
        clearError();
        hideResults();
        state.autoCalc = false;
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        /* Reset keeps the open type: the same calculator stays on screen with
           empty fields instead of jumping to another profile. */
        if (state.type) {
            renderFields();
            draw();
        }
    }

    /* ==================================================
       EVENTS
    ================================================== */

    function cacheDom() {
        dom.designType = $("designType");
        dom.dimensionsCard = $("dimensionsCard");
        dom.materialCard = $("materialCard");
        dom.actionsBar = $("actionsBar");
        dom.methodCard = $("methodCard");
        dom.faqCard = $("faqCard");
        dom.fieldGrid = $("fieldGrid");
        dom.materialFields = $("materialFields");
        dom.dishFigure = $("dishFigure");
        dom.dishDrawing = $("dishDrawing");
        dom.mmBtn = $("mmBtn");
        dom.inchBtn = $("inchBtn");
        dom.unitNote = $("unitNote");
        dom.divisionBlock = $("divisionBlock");
        dom.divisionGrid = $("divisionGrid");
        dom.material = $("material");
        dom.density = $("density");
        dom.densityNote = $("densityNote");
        dom.quantity = $("quantity");
        dom.error = $("error");
        dom.calculateBtn = $("calculateBtn");
        dom.resetBtn = $("resetBtn");
        dom.results = $("results");
        dom.totalWeight = $("totalWeight");
        dom.tonnes = $("tonnes");
        dom.geoRows = $("geoRows");
        dom.devRows = $("devRows");
        dom.matRows = $("matRows");
        dom.coordWrap = $("coordWrap");
        dom.coordBody = $("coordBody");
        dom.coordNote = $("coordNote");
        dom.resultNote = $("resultNote");
        dom.methodEquation = $("methodEquation");
        dom.methodLegend = $("methodLegend");
        dom.methodBody = $("methodBody");
        dom.methodExample = $("methodExample");
        dom.faqList = $("faqList");
        dom.pageTitle = $("pageTitle");
        dom.drawingAlt = $("drawingTitle");
    }

    function bindEvents() {
        /* The dropdown is the single control for the selection: it opens the
           chosen type directly inside selectType(). */
        if (dom.designType) {
            dom.designType.addEventListener("change", function () {
                selectType(dom.designType.value || null);
            });
        }

        dom.fieldGrid.addEventListener("input", function (event) {
            var key = event.target.dataset.field;
            if (!key) {
                return;
            }
            event.target.removeAttribute("aria-invalid");
            var raw = event.target.value.trim();
            if (raw === "") {
                state.mm[key] = null;
            } else {
                var value = Number(raw);
                state.mm[key] = Number.isFinite(value) ? value * unitFactor() : null;
            }
            updateDerived();
            draw();
            if (state.autoCalc) {
                calculate({ silent: true }).then(function (ok) {
                    if (!ok) {
                        hideResults();
                    }
                });
            }
        });

        dom.mmBtn.addEventListener("click", function () {
            setUnit("mm");
        });
        dom.inchBtn.addEventListener("click", function () {
            setUnit("in");
        });

        dom.divisionGrid.addEventListener("click", function (event) {
            var button = event.target.closest(".division-btn");
            if (button) {
                setDivisions(button.dataset.divisions);
            }
        });

        dom.material.addEventListener("change", function () {
            applyMaterial(dom.material.value);
            draw();
            calculate({ silent: true }).then(function (ok) {
                if (!ok) {
                    hideResults();
                }
            });
        });

        dom.density.addEventListener("input", function () {
            state.densityEdited = true;
            dom.density.setAttribute("data-user-edited", "true");
            if (state.material !== "custom") {
                dom.densityNote.textContent =
                    "Density entered manually; the selected material name is kept for reference.";
            }
            calculate({ silent: true }).then(function (ok) {
                if (!ok) {
                    hideResults();
                }
            });
        });

        dom.quantity.addEventListener("input", function () {
            var value = Number(dom.quantity.value);
            state.quantity = value;
            calculate({ silent: true }).then(function (ok) {
                if (!ok) {
                    hideResults();
                }
            });
        });

        dom.calculateBtn.addEventListener("click", function () {
            calculate({ silent: false });
        });

        dom.resetBtn.addEventListener("click", resetAll);

        /* Enter walks the fields in the order they are laid out on screen:
           left to right across the grid, then the first field of the next row.
           The order is read from the rendered form, so it follows the visual
           arrangement of the selected type instead of a hard-coded list. */
        bindEnterNavigation(dom.fieldGrid, function () {
            calculate({ silent: false });
        });
        bindEnterNavigation(dom.materialFields, function () {
            calculate({ silent: false });
        });

    }

    /* Visible inputs of a container, in layout order. */
    function navInputs(container) {
        if (!container) {
            return [];
        }
        return Array.prototype.slice.call(container.querySelectorAll("input"))
            .filter(function (input) {
                return !input.disabled && input.type !== "hidden" &&
                    input.getClientRects().length > 0;
            });
    }

    /* Enter moves to the next input of the group; on the last one it runs the
       action the group ends with. */
    function bindEnterNavigation(container, onLast) {
        if (!container) {
            return;
        }
        container.addEventListener("keydown", function (event) {
            if (event.key !== "Enter" || event.target.tagName !== "INPUT") {
                return;
            }
            var inputs = navInputs(container);
            var index = inputs.indexOf(event.target);
            if (index === -1) {
                return;
            }
            event.preventDefault();
            var next = inputs[index + 1];
            if (next) {
                next.focus();
                if (next.select) {
                    next.select();
                }
            } else {
                onLast();
            }
        });
    }

    function init() {
        cacheDom();
        BASE_TITLE = dom.pageTitle.textContent.trim();

        bindEvents();
        bindDensityToggle();
        syncDivisions();
        applyMaterial("carbon-steel");
        /* Open on the type prompt; a calculator appears only after the user
           picks a dish end type from the dropdown. */
        selectType(null);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    /* Shared header history. The calculator name stays constant so every head
       type uses one saved list, while each record shows the dimensions that
       belong to the type that produced it. */
    window.CALCULATOR_HISTORY_CONFIG = {
        calculatorName: "Dish Ends Calculator",
        shapeName: function () {
            return state.type && TYPE_INFO[state.type]
                ? TYPE_INFO[state.type].name
                : "Dish End";
        },
        historyKey: "dish-ends",
        sizeLabels: true,
        dimensions: [
            { key: "id", label: "Inside Diameter (ID)" },
            { key: "kr", label: "Knuckle Radius (R)" },
            { key: "h", label: "Dish Height (H)" },
            { key: "sf", label: "Straight Flange (SF)" },
            { key: "t", label: "Thickness (T)" }
        ],
        getCalculation: function () {
            var result = state.last;

            if (!result) {
                return null;
            }

            var factor = state.unit === "in" ? 1 / MM_PER_INCH : 1;
            var hasKnuckle = result.kind === "flat" ||
                result.kind === "torispherical";
            var hasHeight = result.kind === "ellipsoidal" ||
                result.kind === "template";

            return {
                id: result.id * factor,
                kr: hasKnuckle ? result.KR * factor : undefined,
                h: hasHeight ? result.H * factor : undefined,
                sf: result.SF * factor,
                t: result.T * factor,
                unit: state.unit,
                quantity: result.quantity,
                density: result.density,
                densityUnit: "kg/m\u00b3",
                materialName: result.materialName,
                singleWeight: result.weight,
                totalWeight: result.totalWeight
            };
        }
    };
}());
