/* ==================================================
   DISH ENDS CALCULATOR JAVASCRIPT START
   Five dish end types: flat, torispherical, ellipsoidal,
   hemispherical and elliptical head template.
   Contains the geometry, the live SVG drawing engine,
   validation, the calculation results and the PDF export.
================================================== */
"use strict";

(function () {
    /* ==================================================
       CONSTANTS
    ================================================== */

    var MM_PER_INCH = 25.4;

    var MATERIALS = Object.freeze({
        "carbon-steel": { name: "Carbon Steel", density: 7850 },
        "ss-304": { name: "Stainless Steel 304", density: 7930 },
        "ss-316": { name: "Stainless Steel 316", density: 7980 },
        "ss-316l": { name: "Stainless Steel 316L", density: 8000 },
        "aluminium": { name: "Aluminium", density: 2700 },
        "custom": { name: "Custom Material", density: null }
    });

    var TYPE_INFO = {
        flat: {
            name: "Flat Head",
            title: "Flat Head Weight Calculator",
            drawingTitle: "FLAT HEAD \u00b7 SECTION",
            drawingAlt: "Flanged flat head section with inside diameter, crown height, knuckle radius and straight flange dimensions",
            legend: "ID = Inside Diameter \u00b7 H = Crown Height \u00b7 R = Knuckle Radius \u00b7 SF = Straight Flange",
            drawingNote: "Flanged flat head: flat crown, knuckle radius R, straight flange SF. H = R for this profile.",
            equation: "W = (\u03c0 \u00d7 R\u00b2 + 2\u03c0 \u00d7 R \u00d7 SF) \u00d7 T \u00d7 \u03c1 \u00f7 10\u2079",
            variables: "W = weight (kg) &middot; R = inside radius, ID &divide; 2 (mm) &middot; SF = straight flange (mm) &middot; T = thickness (mm) &middot; &rho; = density (kg/m&sup3;)",
            resultNote: "Flat crown plus knuckle and straight flange; the knuckle fillet area is not added to the developed area.",
            method: "<ul class=\"method-list\">" +
                "<li>Flat plate area: A<sub>plate</sub> = \u03c0 \u00d7 R\u00b2 with R = ID \u00f7 2.</li>" +
                "<li>Straight face: A<sub>SF</sub> = 2\u03c0 \u00d7 R \u00d7 SF, treated as a cylindrical flange of height SF.</li>" +
                "<li>Developed blank: \u00d8 = 2 \u00d7 \u221a((A<sub>plate</sub> + A<sub>SF</sub>) \u00f7 \u03c0).</li>" +
                "<li>The knuckle radius R is the corner radius between the flat crown and the straight flange; the crown diameter is ID \u2212 2R and the crown sits R above the tangent line.</li>" +
                "<li>The plate is taken as uniform thickness T with no stiffening and no corrosion allowance.</li>" +
                "</ul>",
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
            legend: "ID = Inside Diameter \u00b7 H = Crown Height \u00b7 R = Knuckle Radius \u00b7 SF = Straight Flange",
            drawingNote: "Crown radius taken as the inside diameter; R is the knuckle radius as entered.",
            equation: "W = (A<sub>knuckle</sub> + A<sub>crown</sub> + A<sub>SF</sub>) \u00d7 T \u00d7 \u03c1 \u00f7 10\u2079",
            variables: "W = weight (kg) &middot; C.R = crown radius = ID (mm) &middot; K.R = knuckle radius (mm) &middot; R = inside radius, ID &divide; 2 (mm) &middot; &theta;k, &theta;c = knuckle and crown arc angles &middot; &rho; = density (kg/m&sup3;)",
            resultNote: "Crown radius is taken as the inside diameter; the crown zone and the knuckle torus are both counted.",
            method: "<ul class=\"method-list\">" +
                "<li>Knuckle angle: \u03b8<sub>k</sub> = cos\u207b\u00b9((R \u2212 K.R) \u00f7 (C.R \u2212 K.R)); crown angle \u03b8<sub>c</sub> = 90\u00b0 \u2212 \u03b8<sub>k</sub>.</li>" +
                "<li>Dish height: H = C.R \u2212 \u221a((C.R \u2212 K.R)\u00b2 \u2212 (R \u2212 K.R)\u00b2).</li>" +
                "<li>Knuckle area (torus): A = 2\u03c0 \u00d7 K.R \u00d7 [(R \u2212 K.R) \u00d7 \u03b8<sub>k</sub> + K.R \u00d7 sin \u03b8<sub>k</sub>].</li>" +
                "<li>Crown area (spherical zone): A = 2\u03c0 \u00d7 C.R \u00d7 (H \u2212 K.R \u00d7 sin \u03b8<sub>k</sub>).</li>" +
                "<li>Straight face: A<sub>SF</sub> = 2\u03c0 \u00d7 R \u00d7 SF. The crown radius is fixed at the inside diameter, which is the standard torispherical proportion.</li>" +
                "</ul>",
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
            legend: "ID = Inside Diameter \u00b7 H = Crown Height \u00b7 R = Crown Radius \u00b7 SF = Straight Flange",
            drawingNote: "Semi-ellipsoidal profile of semi-axes ID \u00f7 2 and H; R is the crown radius of curvature.",
            equation: "A = \u03c0a\u00b2 + (\u03c0b\u00b2 \u00f7 2e) \u00d7 ln((1 + e) \u00f7 (1 \u2212 e))",
            variables: "A = dish surface area (mm&sup2;) &middot; a = ID &divide; 2 (mm) &middot; b = H (mm) &middot; e = eccentricity &middot; SF = straight flange (mm) &middot; &rho; = density (kg/m&sup3;)",
            resultNote: "Dish area is the semi-ellipsoidal surface for a = ID \u00f7 2 and b = H; the straight flange is added separately.",
            method: "<ul class=\"method-list\">" +
                "<li>The dish is a true semi-ellipsoid with a = ID \u00f7 2 and b = H, so a 2:1 head is H = ID \u00f7 4.</li>" +
                "<li>Surface area of the semi-ellipsoid (a &gt; b, e = \u221a(1 \u2212 b\u00b2 \u00f7 a\u00b2)): A = \u03c0a\u00b2 + (\u03c0b\u00b2 \u00f7 2e) \u00d7 ln((1 + e) \u00f7 (1 \u2212 e)); for b &gt; a the asin form is used.</li>" +
                "<li>Straight face: A<sub>SF</sub> = 2\u03c0 \u00d7 R \u00d7 SF, measured below the tangent line.</li>" +
                "<li>Developed blank: \u00d8 = 2 \u00d7 \u221a(A \u00f7 \u03c0), the area-equivalent flat plate diameter.</li>" +
                "</ul>",
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
            legend: "ID = Inside Diameter \u00b7 H = Crown Height \u00b7 R = Inside Radius \u00b7 SF = Straight Flange",
            drawingNote: "Exactly half of a sphere: H = R = ID \u00f7 2.",
            equation: "W = (2\u03c0 \u00d7 R\u00b2 + 2\u03c0 \u00d7 R \u00d7 SF) \u00d7 T \u00d7 \u03c1 \u00f7 10\u2079",
            variables: "W = weight (kg) &middot; R = inside radius = H = ID &divide; 2 (mm) &middot; SF = straight flange (mm) &middot; T = thickness (mm) &middot; &rho; = density (kg/m&sup3;)",
            resultNote: "A half sphere: the height equals the inside radius and the dome area is 2\u03c0R\u00b2.",
            method: "<ul class=\"method-list\">" +
                "<li>Dome area of a half sphere: A<sub>dome</sub> = 2\u03c0 \u00d7 R\u00b2 with R = ID \u00f7 2.</li>" +
                "<li>Dish height is fixed by the geometry: H = R.</li>" +
                "<li>Straight face: A<sub>SF</sub> = 2\u03c0 \u00d7 R \u00d7 SF.</li>" +
                "<li>Developed blank: \u00d8 = 2 \u00d7 \u221a(A \u00f7 \u03c0), which is \u221a2 \u00d7 ID when SF = 0.</li>" +
                "</ul>",
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
            legend: "ID = Inside Diameter \u00b7 H = Crown Height \u00b7 R = Crown Radius \u00b7 SF = Straight Flange \u00b7 teal lines = radial divisions",
            drawingNote: "Section with radial division lines and the area-equivalent developed blank.",
            equation: "s(t) = \u222b\u2080\u1d57 \u221a(R\u00b2cos\u00b2u + H\u00b2sin\u00b2u) du",
            variables: "s = meridian arc length from the apex (mm) &middot; R = ID &divide; 2 (mm) &middot; H = head height (mm) &middot; t = meridian parameter (rad) &middot; \u00d8 = area-equivalent blank diameter",
            resultNote: "The blank is the area-equivalent plate; a shop forming and trim allowance must be added.",
            method: "<ul class=\"method-list\">" +
                "<li>The meridian is a quarter ellipse; the true length from the apex to a station is integrated from s(t) = \u222b\u2080\u1d57 \u221a(R\u00b2cos\u00b2u + H\u00b2sin\u00b2u) du.</li>" +
                "<li>The circumference is divided into the selected number of equal angular divisions (12 to 96); each station is reported with its plan radius, height, meridian length and blank coordinates.</li>" +
                "<li>The developed blank is the area-equivalent flat plate: \u00d8 = 2 \u00d7 \u221a(A \u00f7 \u03c0).</li>" +
                "<li>A double-curved surface cannot be flattened without distortion, so the blank is an area-equivalent template. Forming, weld and trim allowances are a shop decision and are not included.</li>" +
                "</ul>",
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
                    q: "Can I print the template at full size?",
                    a: "The Print Drawing and Download PDF buttons output the section, the blank and the station table. Browsers scale to the paper, so check the printed scale or set your plotter to 100% before cutting metal."
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

    function renderExample(type) {
        if (!dom.methodExample) {
            return;
        }

        var ex = EXAMPLE_GEOMETRY[type];
        var r = computeResult({
            id: ex.id,
            kr: ex.kr,
            h: ex.h,
            sf: ex.sf,
            t: ex.t,
            density: EXAMPLE_DENSITY,
            quantity: 1,
            divisions: state.divisions,
            materialName: "Carbon Steel"
        });

        var values = TYPE_FIELDS[type].map(function (key) {
            var meta = FIELD_META[key];
            return '<div class="example-value">' +
                '<span class="example-value-label">' + meta.label + " (" + meta.notation + ")</span>" +
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
        mm: "All dimensions are in mm; angles in degrees.",
        in: "All dimensions are in inches; angles in degrees."
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
        type: "flat",
        unit: "mm",
        mm: { id: null, kr: null, sf: null, h: null, t: null },
        divisions: 24,
        material: "carbon-steel",
        densityEdited: false,
        quantity: 1,
        hasResult: false,
        last: null
    };

    var dom = {};

    /* ==================================================
       SMALL HELPERS
    ================================================== */

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
       vector PDF for the template export.
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
       HEAD DRAWING (FOUR SECTION TYPES)
    ================================================== */

    function headSketch(type, dims, unit) {
        /* Every head type is drawn on the same 880 x 400 sheet, so the drawing keeps
           one fixed visual size. The internal scale below only places the profile
           inside that sheet; it never changes the sheet itself. */
        var canvasW = 880;
        var canvasH = 400;
        var sk = sketch(canvasW, canvasH);
        var bandTop = 74;
        var bandBottom = 346;
        var noteY = 386;
        var Rmm = Math.max(dims.id / 2, 1);
        /* Flat head: R is the corner radius between the flat crown and the flange,
           so the flat crown sits KRmm above the tangent line. */
        var KRmm = clamp(dims.kr > 0 ? dims.kr : Rmm * 0.1, Rmm * 0.02, Rmm * 0.98);
        var knuckleMM = type === "flat" ? KRmm
            : clamp(dims.kr > 0 ? dims.kr : Rmm * 0.1, Rmm * 0.02, Rmm * 0.98);
        var Hmm = type === "flat" ? KRmm
            : type === "hemispherical" ? Rmm
                : type === "torispherical" ? torispherical(Rmm, Rmm * 2, knuckleMM).H
                    : Math.max(dims.h, 0);
        var SF = Math.max(dims.sf, 0);
        /* The profile width alone fixes the scale, so the figure keeps a stable size
           for every value entered; the height cap only keeps deep heads inside the
           sheet band. */
        var scale = type === "flat"
            ? 226 / Rmm
            : Math.min(226 / Rmm, 200 / Math.max(Hmm, 1e-6));
        var cx = canvasW / 2;
        var domePx = Hmm * scale;
        var facePx = Math.min(SF * scale, 48);
        var wallPx = clamp(dims.t * scale, 3.5, 10);
        var wallMM = wallPx / scale;
        var contentH = domePx + facePx;
        var rimY = bandTop + Math.max(0, (bandBottom - bandTop - contentH) / 2) + domePx;
        var apexY = rimY - domePx;
        var bottomY = rimY + facePx;
        var xL = cx - Rmm * scale;
        var xR = cx + Rmm * scale;
        var inside = null;
        var outside = null;

        function toPx(p) {
            return [cx + p[0] * scale, rimY - p[1] * scale];
        }

        inside = type === "flat"
            ? insidePath("flat", Rmm, KRmm, KRmm, 0, SF)
            : insidePath(type, Rmm, Hmm, knuckleMM, Rmm * 2, SF);
        outside = offsetProfile(inside, wallMM);
        poly(sk, inside.concat(outside.slice().reverse()).map(toPx), "outline",
            { fill: true, closed: true });

        /* Centreline and the rim (tangent) reference line */
        line(sk, cx, Math.min(apexY - 30, 84), cx, bottomY + 18, "centre");
        line(sk, xL - 46, rimY, xR + 46, rimY, "ref");

        /* ID: inside diameter, below the profile */
        dimH(sk, xL, xR, bottomY + 26, "ID = " + dimText(dims.id), bottomY);

        /* SF: straight flange, outside the left flange */
        if (SF > 0) {
            dimV(sk, xL - 34, rimY, bottomY, "SF = " + dimText(SF), xL, "left");
        }

        /* H: crown height, from the crown top level down to the reference line */
        var hx = xR + 46;
        var hArrow = rimY - apexY < 24 ? 4.5 : 7;
        line(sk, cx, apexY, hx + 6, apexY, "ext");
        line(sk, xR, rimY, hx + 6, rimY, "ext");
        line(sk, hx, apexY, hx, rimY, "dim");
        arrow(sk, hx, apexY, 0, -1, "dim", hArrow);
        arrow(sk, hx, rimY, 0, 1, "dim", hArrow);
        label(sk, hx + 7, (apexY + rimY) / 2 + 4, "H = " + dimText(Hmm), {
            anchor: "start", size: 11, kind: "dim"
        });

        /* R: radius callout. Knuckle radius on the flat and torispherical heads,
           inside radius on the hemisphere, crown radius on the elliptical profile. */
        if (type === "flat" || type === "torispherical") {
            /* Leader onto the left knuckle arc, label kept clear of the profile. */
            var knuckleAngle = type === "flat"
                ? Math.PI * 0.26
                : torispherical(Rmm, Rmm * 2, knuckleMM).thetaK * 0.42;
            var arcPt = toPx([
                -(Rmm - knuckleMM) - knuckleMM * Math.cos(knuckleAngle),
                knuckleMM * Math.sin(knuckleAngle)
            ]);
            var leadX = arcPt[0] - 24;
            var leadY = arcPt[1] - 30;
            line(sk, leadX, leadY + 5, arcPt[0], arcPt[1], "dim");
            arrow(sk, arcPt[0], arcPt[1],
                arcPt[0] - leadX, arcPt[1] - leadY - 5, "dim", 5.5);
            label(sk, leadX - 3, leadY, "R = " + dimText(dims.kr > 0 ? dims.kr : knuckleMM), {
                anchor: "end", size: 11, kind: "label"
            });
        } else if (type === "hemispherical") {
            var angle = Math.PI * 0.28;
            var arcPoint = [cx + Rmm * scale * Math.cos(angle), rimY - Rmm * scale * Math.sin(angle)];
            var tailX = cx + (Rmm * scale + 34) * Math.cos(angle);
            var tailY = rimY - (Rmm * scale + 34) * Math.sin(angle);
            line(sk, cx, rimY, tailX, tailY, "dim");
            arrow(sk, arcPoint[0], arcPoint[1], arcPoint[0] - cx, arcPoint[1] - rimY, "dim");
            label(sk, tailX + 7, tailY + 4, "R = " + dimText(Rmm), {
                anchor: "start", size: 11, kind: "label"
            });
        } else {
            /* Radius of curvature at the crown of the ellipse: R = a\u00b2 \u00f7 b. */
            var crownR = (Rmm * Rmm) / Math.max(Hmm, 1e-6);
            var crownT = Math.PI * 0.2;
            var crownPt = toPx([-Rmm * Math.sin(crownT), Hmm * Math.cos(crownT)]);
            var crownLeadX = crownPt[0] - 28;
            var crownLeadY = crownPt[1] - 32;
            line(sk, crownLeadX, crownLeadY + 5, crownPt[0], crownPt[1], "dim");
            arrow(sk, crownPt[0], crownPt[1],
                crownPt[0] - crownLeadX, crownPt[1] - crownLeadY - 5, "dim", 5.5);
            label(sk, crownLeadX - 3, crownLeadY, "R = " + dimText(crownR), {
                anchor: "end", size: 11, kind: "label"
            });
        }

        textHeader(sk, TYPE_INFO[type], unit);
        label(sk, 24, noteY, TYPE_INFO[type].drawingNote, { size: 9.5, kind: "note" });
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

    function templateSketch(dims, unit) {
        var sk = sketch(880, 400);
        var R = Math.max(dims.id / 2, 1);
        var H = Math.max(dims.h, 0.0001);
        var SF = Math.max(dims.sf, 0);
        var T = Math.max(dims.t, 0.0001);
        var N = dims.divisions;
        var dishArea = ellipsoidDishArea(R, H);
        var faceArea = 2 * Math.PI * R * SF;
        var areaTotal = dishArea + faceArea;
        var blankDia = 2 * Math.sqrt(areaTotal / Math.PI);
        var stations = buildStations(R, H, N, blankDia / 2);

        /* Left panel: section with the radial division lines */
        var cx1 = 236;
        var rimY1 = 292;
        var scale1 = Math.min(124 / R, 168 / H);
        var facePx1 = Math.min(SF * scale1, 34);
        var wallPx1 = clamp(T * scale1, 3.2, 8);
        var apexY1 = rimY1 - H * scale1;
        var bottomY1 = rimY1 + facePx1;
        var xL1 = cx1 - R * scale1;
        var xR1 = cx1 + R * scale1;

        function toPx1(p) {
            return [cx1 + p[0] * scale1, rimY1 - p[1] * scale1];
        }

        var inside1 = insidePath("ellipsoidal", R, H, 0, 0, SF);
        var outside1 = offsetProfile(inside1, wallPx1 / scale1);
        poly(sk, inside1.concat(outside1.slice().reverse()).map(toPx1), "outline",
            { fill: true, closed: true });

        for (var i = 1; i < N / 2; i++) {
            var station = stations[i];
            var sx = toPx1([station.planRadius, 0])[0];
            var sy = toPx1([station.planRadius, station.height])[1];
            line(sk, sx, rimY1, sx, sy, "dev");
            line(sk, 2 * cx1 - sx, rimY1, 2 * cx1 - sx, sy, "dev");
        }

        line(sk, cx1, apexY1 - 30, cx1, bottomY1 + 32, "centre");
        label(sk, cx1 + 8, apexY1 - 32, "MIRROR LINE", { size: 9, kind: "note" });
        line(sk, xL1 - 40, rimY1, xR1 + 40, rimY1, "ref");

        dimH(sk, xL1, xR1, bottomY1 + 26, "ID = " + dimText(dims.id), bottomY1);

        var hx1 = xR1 + 34;
        line(sk, cx1, apexY1, hx1 + 6, apexY1, "ext");
        line(sk, xR1, rimY1, hx1 + 6, rimY1, "ext");
        line(sk, hx1, apexY1, hx1, rimY1, "dim");
        arrow(sk, hx1, apexY1, 0, -1, "dim", 5);
        arrow(sk, hx1, rimY1, 0, 1, "dim", 5);
        label(sk, hx1 + 7, (apexY1 + rimY1) / 2 + 4, "H = " + dimText(H), {
            anchor: "start", size: 11, kind: "dim"
        });

        /* SF: straight flange of the section */
        if (SF > 0) {
            var sfX = xL1 - 20;
            line(sk, xL1, rimY1, sfX - 6, rimY1, "ext");
            line(sk, xL1, bottomY1, sfX - 6, bottomY1, "ext");
            line(sk, sfX, rimY1, sfX, bottomY1, "dim");
            arrow(sk, sfX, rimY1, 0, -1, "dim", 5);
            arrow(sk, sfX, bottomY1, 0, 1, "dim", 5);
            label(sk, sfX - 4, rimY1 - 8, "SF = " + dimText(SF), {
                anchor: "end", size: 11, kind: "dim"
            });
        }

        /* R: crown radius of curvature at the apex, R = a\u00b2 \u00f7 b */
        var crownR1 = (R * R) / H;
        var crownT1 = Math.PI * 0.2;
        var crownPt1 = toPx1([-R * Math.sin(crownT1), H * Math.cos(crownT1)]);
        line(sk, crownPt1[0] - 26, crownPt1[1] - 28, crownPt1[0], crownPt1[1], "dim");
        arrow(sk, crownPt1[0], crownPt1[1], 26, 23, "dim", 5);
        label(sk, crownPt1[0] - 30, crownPt1[1] - 32, "R = " + dimText(crownR1), {
            anchor: "end", size: 11, kind: "label"
        });

        label(sk, 24, 54, "HALF SECTION", { size: 10.5, kind: "note" });
        label(sk, 24, 74, N + " equal divisions at " + fmt(360 / N, 2) + "\u00b0", {
            size: 10, kind: "note"
        });

        /* Right panel: developed blank with the radial layout lines */
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

        dimH(sk, bx - rMax, bx + rMax, by + rMax + 30, "BLANK \u00d8 = " + dimText(blankDia),
            by + rMax);

        label(sk, 512, 54, "DEVELOPED BLANK", { size: 11.5, kind: "title" });
        label(sk, 512, 74, "Area-equivalent \u00b7 " + N + " radial lines", { size: 10, kind: "note" });
        line(sk, 500, 92, 500, 356, "ref");

        textHeader(sk, TYPE_INFO.template, unit);
        label(sk, 30, 386,
            "Meridian lengths measured from the apex \u00b7 forming, weld and trim allowances not included",
            { size: 9.5, kind: "note" });

        sk.meta = {
            blankDia: blankDia,
            areaTotal: areaTotal,
            stations: stations,
            divisions: N,
            id: dims.id,
            h: H,
            sf: SF,
            t: T
        };
        return sk;
    }

    /* ==================================================
       TYPE CARD THUMBNAILS
    ================================================== */

    function miniFigure(type) {
        var sk = sketch(132, 76);
        var cx = 66;
        var base = 60;
        var R = 40;
        var wall = 2;
        var map = function (p) {
            return [cx + p[0], base - p[1]];
        };

        if (type === "flat") {
            var mKR = 13;
            var mIn = insidePath("flat", R, mKR, mKR, 0, 6);
            var mOut = offsetProfile(mIn, wall);
            poly(sk, mIn.concat(mOut.slice().reverse()).map(map), "outline",
                { fill: true, closed: true });
            line(sk, cx - R - 10, base, cx + R + 10, base, "ref");
            return sketchToSVG(sk);
        }

        var H = type === "hemispherical" ? R : (type === "torispherical" ? 16 : 22);
        var KR = type === "torispherical" ? 8 : 0;
        var CR = type === "torispherical" ? 80 : 0;
        var inside = insidePath(type === "template" ? "ellipsoidal" : type, R, H, KR, CR, 5);
        var outside = offsetProfile(inside, wall);
        poly(sk, inside.concat(outside.slice().reverse()).map(map), "outline",
            { fill: true, closed: true });
        line(sk, cx - R - 10, base, cx + R + 10, base, "ref");

        if (type === "template") {
            for (var i = 1; i < 6; i++) {
                var angle = (Math.PI * i) / 12;
                var x = R * Math.cos(angle);
                var y = H * Math.sqrt(Math.max(0, 1 - (x / R) * (x / R)));
                line(sk, cx + x, base, cx + x, base - y, "dev");
            }
        }
        return sketchToSVG(sk);
    }

    /* ==================================================
       CALCULATION
    ================================================== */

    function computeResult(input) {
        var type = state.type;
        var R = input.id / 2;
        var T = input.t;
        var SF = input.sf;
        var H = 0;
        var CR = null;
        var KR = null;
        var thetaC = null;
        var thetaK = null;
        var dishArea = 0;
        var meridian = 0;

        if (type === "flat") {
            H = 0;
            KR = input.kr;
            dishArea = Math.PI * R * R;
            meridian = R;
        } else if (type === "torispherical") {
            CR = input.id;
            KR = input.kr;
            var g = torispherical(R, CR, KR);
            H = g.H;
            thetaC = g.thetaC;
            thetaK = g.thetaK;
            dishArea = g.aKnuckle + g.aCrown;
            meridian = KR * g.thetaK + CR * g.thetaC;
        } else if (type === "hemispherical") {
            H = R;
            CR = R;
            dishArea = 2 * Math.PI * R * R;
            meridian = (Math.PI * R) / 2;
        } else {
            H = input.h;
            dishArea = ellipsoidDishArea(R, H);
            meridian = meridianArc(R, H, Math.PI / 2);
        }

        var faceArea = 2 * Math.PI * R * SF;
        var areaTotal = dishArea + faceArea;
        var blankDia = 2 * Math.sqrt(areaTotal / Math.PI);
        var blankArea = (Math.PI * blankDia * blankDia) / 4;
        var weight = (areaTotal * T * input.density) / 1e9;

        var result = {
            kind: type,
            name: TYPE_INFO[type].name,
            id: input.id,
            R: R,
            T: T,
            SF: SF,
            H: H,
            CR: CR,
            KR: KR,
            thetaC: thetaC,
            thetaK: thetaK,
            dishArea: dishArea,
            faceArea: faceArea,
            areaTotal: areaTotal,
            meridian: meridian,
            blankDia: blankDia,
            blankArea: blankArea,
            weight: weight,
            quantity: input.quantity,
            totalWeight: weight * input.quantity,
            density: input.density,
            materialName: input.materialName,
            divisions: null,
            stepDeg: null,
            stations: null
        };

        if (type === "template") {
            result.divisions = input.divisions;
            result.stepDeg = 360 / input.divisions;
            result.stations = buildStations(R, H, input.divisions, blankDia / 2);
        }

        return result;
    }

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

    function previewDims() {
        var id = state.mm.id > 0 ? state.mm.id : 1000;
        var R = id / 2;
        var sf = state.mm.sf !== null && state.mm.sf >= 0 ? state.mm.sf : id * 0.04;
        var t = state.mm.t > 0 ? state.mm.t : Math.max(id * 0.006, 2);
        var kr = state.mm.kr > 0 ? state.mm.kr : id * 0.1;
        var h = state.mm.h > 0 ? state.mm.h : id * 0.25;

        return {
            id: id,
            sf: sf,
            t: clamp(t, 1, R * 0.4),
            kr: clamp(kr, id * 0.01, R * 0.985),
            h: clamp(h, id * 0.02, id),
            divisions: state.divisions
        };
    }

    function draw() {
        var dims = previewDims();
        var sk = state.type === "template"
            ? templateSketch(dims, state.unit)
            : headSketch(state.type, dims, state.unit);

        dom.dishDrawing.innerHTML = sketchToSVG(sk);
        /* The viewBox is fixed in the markup: the drawing never resizes. */
        dom.drawingLegend.textContent = TYPE_INFO[state.type].legend;
        var exampleKr = (state.type === "flat" || state.type === "torispherical") &&
            !(state.mm.kr > 0);
        dom.drawingStatus.textContent = state.mm.id > 0
            ? (exampleKr
                ? "Dimensions entered above; the knuckle radius shown is an example until you enter R."
                : "Drawing reflects the dimensions entered above.")
            : "Example proportions are shown until you enter the inside diameter.";
    }

    /* ==================================================
       FIELDS
    ================================================== */

    function fieldHtml(key) {
        var meta = FIELD_META[key];
        var value = state.mm[key] === null || state.mm[key] === undefined
            ? ""
            : formatInput(state.mm[key]);
        var placeholder = PLACEHOLDERS[state.unit][key];

        return '<div>' +
            '<label for="field-' + key + '">' + meta.label + " (" + meta.notation + ")</label>" +
            '<input type="number" id="field-' + key + '" data-field="' + key +
            '" min="0" step="any" inputmode="decimal" autocomplete="off" ' +
            'placeholder="' + placeholder + '" value="' + value + '">' +
            "</div>";
    }

    function renderFields() {
        var fields = TYPE_FIELDS[state.type];
        var html = "";

        fields.forEach(function (key) {
            html += fieldHtml(key);
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

    function focusField(field) {
        var input = field === "density" ? dom.density
            : field === "quantity" ? dom.quantity
            : $("field-" + field);
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
    }

    /* ==================================================
       ACTIONS
    ================================================== */

    function calculate(options) {
        var silent = options && options.silent;
        var input = readInput();

        if (!input.ok) {
            if (!silent) {
                showError(input.message);
                focusField(input.field);
            }
            return false;
        }

        clearError();
        var result = computeResult(input.value);
        state.last = result;
        state.hasResult = true;
        renderResult(result);

        if (!silent && window.innerWidth < 720) {
            dom.results.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return true;
    }

    function selectType(type) {
        if (!TYPE_INFO[type]) {
            return;
        }
        state.type = type;
        dom.typeGrid.querySelectorAll(".type-card").forEach(function (card) {
            card.setAttribute("aria-checked", card.dataset.type === type ? "true" : "false");
        });

        renderFields();
        dom.divisionBlock.hidden = type !== "template";
        dom.exportCard.hidden = type !== "template";
        dom.drawingLegend.textContent = TYPE_INFO[type].legend;
        dom.drawingAlt.textContent = TYPE_INFO[type].drawingAlt;
        dom.pageTitle.textContent = TYPE_INFO[type].title;
        dom.methodEquation.innerHTML = TYPE_INFO[type].equation;
        dom.methodLegend.innerHTML = TYPE_INFO[type].variables;
        dom.methodBody.innerHTML = TYPE_INFO[type].method;
        renderExample(type);
        renderFaqs(type);
        clearError();
        hideResults();
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
            if (!calculate({ silent: true })) {
                hideResults();
            }
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
            if (!calculate({ silent: true })) {
                hideResults();
            }
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
    }

    function resetAll() {
        state.mm = { id: null, kr: null, sf: null, h: null, t: null };
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
        selectType("flat");
        clearError();
        hideResults();
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        draw();
    }

    /* ==================================================
       PDF EXPORT
    ================================================== */

    var HELVETICA_WIDTHS = {
        " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191,
        "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
        "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
        "8": 556, "9": 556, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556,
        "@": 1015, "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778,
        "H": 722, "I": 278, "J": 500, "K": 667, "L": 556, "M": 833, "N": 722, "O": 778,
        "P": 667, "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722, "V": 667, "W": 944,
        "X": 667, "Y": 667, "Z": 611, "[": 278, "\\": 278, "]": 278, "^": 469, "_": 556,
        "`": 333, "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556,
        "h": 556, "i": 222, "j": 222, "k": 500, "l": 222, "m": 833, "n": 556, "o": 556,
        "p": 556, "q": 556, "r": 333, "s": 500, "t": 278, "u": 556, "v": 500, "w": 722,
        "x": 500, "y": 500, "z": 500, "{": 334, "|": 260, "}": 334, "~": 584
    };

    function textWidth(text, size) {
        var total = 0;
        for (var i = 0; i < text.length; i++) {
            total += HELVETICA_WIDTHS[text.charAt(i)] || 556;
        }
        return (total / 1000) * size;
    }

    function pdfSafe(text) {
        return String(text)
            .replace(/\u00d8/g, "Dia ")
            .replace(/\u00b0/g, " deg")
            .replace(/\u00b2/g, "2")
            .replace(/\u00b3/g, "3")
            .replace(/\u00b7/g, "-")
            .replace(/[\u2013\u2014]/g, "-")
            .replace(/\u00f7/g, "/")
            .replace(/\u00b1/g, "+/-")
            .replace(/[^\x20-\x7E]/g, "");
    }

    function pdfEscape(text) {
        return pdfSafe(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    }

    function hexToRgb(hex) {
        var value = hex.replace("#", "");
        return [
            parseInt(value.substring(0, 2), 16) / 255,
            parseInt(value.substring(2, 4), 16) / 255,
            parseInt(value.substring(4, 6), 16) / 255
        ];
    }

    function pdfNumber(value) {
        return (Math.round(value * 100) / 100).toString();
    }

    function buildPdf(sk, meta) {
        var pageW = 841.89;
        var pageH = 595.28;
        var margin = 26;
        var blockH = 104;
        var areaW = pageW - margin * 2;
        var areaH = pageH - margin * 2 - blockH - 8;
        var scale = Math.min(areaW / sk.width, areaH / sk.height);
        var ox = margin + (areaW - sk.width * scale) / 2;
        var topY = pageH - margin;

        function px(x) {
            return ox + x * scale;
        }

        function py(y) {
            return topY - y * scale;
        }

        var ops = [];

        function strokeStyle(kind) {
            var style = STYLE[kind] || STYLE.outline;
            var rgb = hexToRgb(style.stroke);
            ops.push(pdfNumber(rgb[0]) + " " + pdfNumber(rgb[1]) + " " + pdfNumber(rgb[2]) + " RG");
            ops.push(pdfNumber(Math.max(style.width * scale, 0.4)) + " w");
            ops.push(style.dash
                ? "[" + style.dash.map(function (d) { return pdfNumber(d * scale); }).join(" ") + "] 0 d"
                : "[] 0 d");
        }

        function fillStyle(color) {
            var rgb = hexToRgb(color);
            ops.push(pdfNumber(rgb[0]) + " " + pdfNumber(rgb[1]) + " " + pdfNumber(rgb[2]) + " rg");
        }

        sk.ops.forEach(function (op) {
            if (op.type === "line") {
                strokeStyle(op.kind);
                ops.push(pdfNumber(px(op.x1)) + " " + pdfNumber(py(op.y1)) + " m " +
                    pdfNumber(px(op.x2)) + " " + pdfNumber(py(op.y2)) + " l S");
            } else if (op.type === "poly") {
                var path = op.pts.map(function (p, i) {
                    return pdfNumber(px(p[0])) + " " + pdfNumber(py(p[1])) + (i ? " l" : " m");
                }).join(" ");
                if (op.closed) {
                    path += " h";
                }
                if (op.fill) {
                    fillStyle(op.solid ? (STYLE[op.kind] || STYLE.outline).stroke : MATERIAL_FILL);
                    ops.push(path + " f");
                }
                strokeStyle(op.kind);
                ops.push(path + (op.closed ? " S" : " S"));
            } else if (op.type === "text") {
                var size = Math.max(op.size * scale, 4.2);
                var rgbText = hexToRgb(TEXT_COLOR[op.kind]);
                var width = textWidth(op.text, size);
                var tx = px(op.x);
                if (op.anchor === "middle") {
                    tx -= width / 2;
                } else if (op.anchor === "end") {
                    tx -= width;
                }
                ops.push(pdfNumber(rgbText[0]) + " " + pdfNumber(rgbText[1]) + " " +
                    pdfNumber(rgbText[2]) + " rg");
                ops.push("BT /" + (op.bold ? "F2" : "F1") + " " + pdfNumber(size) + " Tf " +
                    pdfNumber(tx) + " " + pdfNumber(py(op.y)) + " Td (" +
                    pdfEscape(op.text) + ") Tj ET");
            }
        });

        /* Title block */
        var blockTop = margin + blockH;
        strokeStyle("outline");
        ops.push(pdfNumber(margin) + " " + pdfNumber(margin) + " m " +
            pdfNumber(pageW - margin) + " " + pdfNumber(margin) + " l " +
            pdfNumber(pageW - margin) + " " + pdfNumber(blockTop) + " l " +
            pdfNumber(margin) + " " + pdfNumber(blockTop) + " l h S");

        function blockText(text, x, y, size, bold, color) {
            var rgb = hexToRgb(color || "#182b32");
            ops.push(pdfNumber(rgb[0]) + " " + pdfNumber(rgb[1]) + " " + pdfNumber(rgb[2]) + " rg");
            ops.push("BT /" + (bold ? "F2" : "F1") + " " + pdfNumber(size) + " Tf " +
                pdfNumber(x) + " " + pdfNumber(y) + " Td (" + pdfEscape(text) + ") Tj ET");
        }

        blockText("DISH END TEMPLATE - " + meta.typeName.toUpperCase(), margin + 12, blockTop - 20, 12, true);
        blockText("Critical dimensions from the entered data. Drawing is not to scale at print size.",
            margin + 12, blockTop - 36, 8, false, "#526a70");

        var rows = [
            ["Inside diameter (ID)", meta.id],
            ["Dish height (H)", meta.h],
            ["Straight face (SF)", meta.sf],
            ["Divisions", meta.divisions + " @ " + fmt(360 / meta.divisions, 2) + " deg"],
            ["Blank diameter", meta.blankDia],
            ["Material", meta.material],
            ["Weight per piece", meta.weight],
            ["Quantity", meta.quantity]
        ];

        var colX = margin + 12;
        var rowY = blockTop - 54;
        rows.forEach(function (row, index) {
            var column = index % 2;
            var x = colX + column * 220;
            var y = rowY - Math.floor(index / 2) * 13;
            blockText(row[0], x, y, 7.5, false, "#718087");
            blockText(row[1], x + 118, y, 7.5, true, "#182b32");
        });

        blockText("Theoretical development - forming, weld and trim allowances not included.",
            pageW - margin - 12 - textWidth(
                "Theoretical development - forming, weld and trim allowances not included.", 7),
            margin + 10, 7, false, "#718087");

        var stream = ops.join("\n");
        var objects = [
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pdfNumber(pageW) + " " +
                pdfNumber(pageH) + "] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> " +
                "/Contents 4 0 R >>",
            "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
        ];

        var pdf = "%PDF-1.4\n";
        var offsets = [];
        objects.forEach(function (body, index) {
            offsets.push(pdf.length);
            pdf += (index + 1) + " 0 obj\n" + body + "\nendobj\n";
        });

        var xref = pdf.length;
        pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
        offsets.forEach(function (offset) {
            pdf += ("0000000000" + offset).slice(-10) + " 00000 n \n";
        });
        pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" +
            xref + "\n%%EOF";

        var bytes = new Uint8Array(pdf.length);
        for (var i = 0; i < pdf.length; i++) {
            bytes[i] = pdf.charCodeAt(i) & 0xff;
        }
        return bytes;
    }

    function exportPdf() {
        var dims = previewDims();
        var sk = templateSketch(dims, state.unit);
        var meta = sk.meta;
        var density = Number(dom.density.value);
        var quantity = Number(dom.quantity.value);
        var safeDensity = density > 0 && Number.isFinite(density) ? density : 0;
        var safeQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;

        var bytes = buildPdf(sk, {
            typeName: TYPE_INFO.template.name,
            id: lenText(meta.id),
            h: lenText(meta.h),
            sf: lenText(meta.sf),
            divisions: String(meta.divisions),
            blankDia: lenText(meta.blankDia),
            material: (MATERIALS[state.material] || { name: "Custom" }).name,
            weight: weightText((meta.areaTotal * meta.t * safeDensity) / 1e9),
            quantity: String(safeQuantity)
        });

        var blob = new Blob([bytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "dish-end-template-" + Math.round(meta.id) + "mm-" +
            meta.divisions + "-lines.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 4000);
    }

    function printDrawing() {
        var dims = previewDims();
        var sk = templateSketch(dims, state.unit);
        var meta = sk.meta;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sk.width + " " +
            sk.height + '" width="100%" style="max-height:170mm">' + sketchToSVG(sk) + "</svg>";

        var html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
            "<title>Dish end template - " + Math.round(meta.id) + " mm</title>" +
            "<style>" +
            "@page { size: A4 landscape; margin: 10mm; }" +
            "body { font-family: Arial, Helvetica, sans-serif; color: #182b32; margin: 0; }" +
            "h1 { font-size: 15px; margin: 0 0 4px; }" +
            "p { font-size: 10px; color: #718087; margin: 2px 0; }" +
            "table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }" +
            "td { border: 1px solid #cbd9da; padding: 4px 6px; }" +
            "td.k { color: #718087; width: 22%; }" +
            "svg { display: block; width: 100%; height: auto; }" +
            "</style></head><body>" +
            "<h1>Dish End Template &mdash; " + TYPE_INFO.template.name + "</h1>" +
            "<p>ID " + lenText(meta.id) + " &middot; H " + lenText(meta.h) + " &middot; SF " +
            lenText(meta.sf) + " &middot; " + meta.divisions + " divisions &middot; blank &Oslash; " +
            lenText(meta.blankDia) + "</p>" +
            svg +
            "<table><tr><td class=\"k\">Inside diameter</td><td>" + lenText(meta.id) +
            "</td><td class=\"k\">Dish height</td><td>" + lenText(meta.h) + "</td></tr>" +
            "<tr><td class=\"k\">Straight face</td><td>" + lenText(meta.sf) +
            "</td><td class=\"k\">Divisions</td><td>" + meta.divisions + " at " +
            fmt(360 / meta.divisions, 2) + "&deg;</td></tr>" +
            "<tr><td class=\"k\">Blank diameter</td><td>" + lenText(meta.blankDia) +
            "</td><td class=\"k\">Material</td><td>" +
            (MATERIALS[state.material] || { name: "Custom" }).name + "</td></tr></table>" +
            "<p>Theoretical development; forming, weld and trim allowances are not included.</p>" +
            "</body></html>";

        var win = window.open("", "_blank");
        if (!win) {
            showError("Allow pop-ups for this site to print the drawing.");
            return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        window.setTimeout(function () {
            win.print();
        }, 500);
    }

    /* ==================================================
       EVENTS
    ================================================== */

    function cacheDom() {
        dom.typeGrid = $("typeGrid");
        dom.fieldGrid = $("fieldGrid");
        dom.dishFigure = $("dishFigure");
        dom.dishDrawing = $("dishDrawing");
        dom.drawingLegend = $("drawingLegend");
        dom.drawingStatus = $("drawingStatus");
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
        dom.exportCard = $("exportCard");
        dom.pdfBtn = $("pdfBtn");
        dom.printBtn = $("printBtn");
        dom.methodEquation = $("methodEquation");
        dom.methodLegend = $("methodLegend");
        dom.methodBody = $("methodBody");
        dom.methodExample = $("methodExample");
        dom.faqList = $("faqList");
        dom.pageTitle = $("pageTitle");
        dom.drawingAlt = $("drawingTitle");
    }

    function bindEvents() {
        dom.typeGrid.addEventListener("click", function (event) {
            var card = event.target.closest(".type-card");
            if (card) {
                selectType(card.dataset.type);
            }
        });

        dom.typeGrid.addEventListener("keydown", function (event) {
            var keys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
            if (keys.indexOf(event.key) === -1) {
                return;
            }
            event.preventDefault();
            var cards = Array.prototype.slice.call(dom.typeGrid.querySelectorAll(".type-card"));
            var current = cards.findIndex(function (card) {
                return card.dataset.type === state.type;
            });
            var step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
            var next = (current + step + cards.length) % cards.length;
            selectType(cards[next].dataset.type);
            cards[next].focus();
        });

        dom.fieldGrid.addEventListener("input", function (event) {
            var key = event.target.dataset.field;
            if (!key) {
                return;
            }
            var raw = event.target.value.trim();
            if (raw === "") {
                state.mm[key] = null;
            } else {
                var value = Number(raw);
                state.mm[key] = Number.isFinite(value) ? value * unitFactor() : null;
            }
            updateDerived();
            draw();
            if (state.hasResult) {
                if (!calculate({ silent: true })) {
                    hideResults();
                }
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
            if (state.hasResult && !calculate({ silent: true })) {
                hideResults();
            }
        });

        dom.density.addEventListener("input", function () {
            state.densityEdited = true;
            if (state.material !== "custom") {
                dom.densityNote.textContent =
                    "Density entered manually; the selected material name is kept for reference.";
            }
            if (state.hasResult && !calculate({ silent: true })) {
                hideResults();
            }
        });

        dom.quantity.addEventListener("input", function () {
            var value = Number(dom.quantity.value);
            state.quantity = value;
            if (state.hasResult && !calculate({ silent: true })) {
                hideResults();
            }
        });

        dom.calculateBtn.addEventListener("click", function () {
            calculate({ silent: false });
        });

        dom.resetBtn.addEventListener("click", resetAll);

        dom.pdfBtn.addEventListener("click", exportPdf);
        dom.printBtn.addEventListener("click", printDrawing);

        dom.fieldGrid.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                calculate({ silent: false });
            }
        });
    }

    function init() {
        cacheDom();

        Object.keys(TYPE_INFO).forEach(function (type) {
            var target = document.querySelector('[data-mini="' + type + '"]');
            if (target) {
                target.innerHTML = miniFigure(type);
            }
        });

        bindEvents();
        bindDensityToggle();
        syncDivisions();
        applyMaterial("carbon-steel");
        selectType("flat");
        draw();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
}());
