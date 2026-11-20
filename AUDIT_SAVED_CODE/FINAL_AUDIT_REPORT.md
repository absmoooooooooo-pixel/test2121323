# Nut & Bolt Weight Calculator — Final Audit and Implementation Report

Date: 20 November 2026
Workspace: `A:\SAN\P2\WEIGHT CALCU\WEIGHT CALCU`
Status: implementation complete; visual browser verification not possible in this session (see Limitations).

## 1. Problems identified and corrected

1. **Thread material volume used the tensile stress area.** The old calculation treated the threaded
   portion as a cylinder based on `As`, which understates physical thread material and is a strength
   value, not a mass value. Replaced with the geometric mean of the major-diameter area and the basic
   external root area:
   `At = [A(d) + A(d − 1.226869 × P)] / 2`.
   `threadStressArea()` is retained only for the reported mechanical reference `stressAreaMM2`.

2. **Hex heads and nuts ignored chamfers.** Added derived 30° chamfer geometry for hex heads and nuts.
   Nut bore removal now uses the same thread material area as external threads, so the breakdown
   (`headVolumeMM3`, `socketVolumeMM3`, `threadVolumeMM3`, `volumeMM3`) is internally consistent.

3. **Missing/incorrect standard table rows.** Extended ISO 4014/4017, ISO 4762, ISO 10642, DIN 7991,
   DIN 976-1 and ISO 4032 tables (small sizes, M7, M14/M16/M20 additions, M33–M64, etc.). No
   dimensions were invented.

4. **Thread-length helpers were wrong for several products.** DIN 603 now uses `+19` instead of
   `+15`; socket-head and countersunk screws use the standard partial-thread rule instead of being
   forced to full thread; DIN 938 defaults are `b1 = d`, `b2 = isoThreadLength()`.

5. **Repeated `(mm)` labels polluted the input form.** Removed per-field units. The selected unit now
   appears once in `ALL DIMENSIONS IN MM` / `ALL DIMENSIONS IN INCHES`; SVG callouts still carry explicit
   units and TPI where applicable.

6. **Old drawings were illustrative, not engineering drawings.** Replaced the entire SVG drawing system
   with proportional, multi-view orthographic drawings driven by the live input values.

7. **Stale cache versions.** Bumped `nut-bolt.css` and `nut-bolt.js` to `?v=12` after the dedicated
   full-thread drawing was added.

8. **M10×300 stud value rechecked.** The reported `0.0339 kg` corresponds to an old **M10×50 hex bolt**
   (`0.033899083 kg`), not a 300 mm stud. Corrected M10×300 carbon-steel stud is
   `0.154054838 kg`. The old live server was still serving stale code and was restarted.

## 2. Engineering drawings redesigned

All drawings are SVG, scale from the actual millimetre inputs, keep every label, extension line,
arrowhead and centre line inside the fixed viewBox, and rebuild on unit or dimension changes.

- **Hex bolt, full thread (ISO 4017) — dedicated two-view drawing.** Rebuilt as a strict black-on-white
  AutoCAD-style drawing with exactly two orthographic views: END VIEW and SIDE ELEVATION. The end view
  shows a regular hexagon rotated so the two vertical flats define `S`, horizontal and vertical
  centre lines, and the concentric circular bolt-body boundary. The side view shows the chamfered hex
  head, full-length external thread from the bearing face to the end, centre line, and all five
  requested dimensions: `D` measured vertically across the shank, `P` shown as a bracket spanning one
  pitch between adjacent crests and called out once by a leader arrow, `L` below from the bearing face
  (head excluded), `S` below the end view, and `K` beside the head.
  Every symbol is uppercase and every value is millimetres from the live standard/input data. No
  across-corners `e`, no thread-detail view, no colours, no shadows and no decorative elements.
- **Other hex bolts (ISO 4017/4014):** side elevation + head end view + enlarged thread detail. Labels
  include `d, P, L, s, e, k`; partial-thread products also label `b`. Full-thread and blank variants are
  distinguished. `L` excludes head height. `s` and `e` are never interchanged (`e = s / cos30°`).
- **Hex nut (ISO 4032 etc.):** top hex end view + sectional side view. Labels include `d, P, s, e, m`,
  with hatched material, derived chamfers and a proportional threaded bore.
- **Stud (DIN 976-1 / DIN 938):** side elevation + end view + enlarged thread detail. No head; full
  length thread for stud/rod; separate `b1`/`b2` dimensions for double-end studs.
- **Countersunk socket screw (ISO 10642 / DIN 7991):** side elevation + top view + sectional side view.
  Shows the 90° countersink, internal hex socket, and labels `d, P, L, dk, k, s, t`.
- Socket head cap screws and carriage bolts were also given proper multi-view treatment.

## 3. Formula and unit verification

- Source check: `backend/core/weight.js` uses
  `singleWeight = volumeMM3 × density / 1,000,000`.
- API spot check for M10×300 carbon-steel stud:
  `volumeMM3 = 19624.820128`, `threadAreaMM2 = 65.416067`, `stressAreaMM2 = 57.989475`,
  `singleWeight = 0.154054838 kg`.
- Independent multiplication check: `19624.820128418345 × 7.85 / 1e6 = 0.154054838008084 kg`.
- Internal calculation remains millimetres; conversion is display-only. Inch input converts by 25.4.

## 4. Standards verification

Verified and extended the internal size tables for ISO 4014, ISO 4017, ISO 4032, ISO 4762,
ISO 10642, DIN 7991, DIN 976-1, DIN 938, DIN 603 and the related nut/ASME tables already present.
Examples confirmed in source: M1.6–M64 bolt rows, M7, M39–M64, ISO 4762 M1.6–M64, DIN 976-1 M2–M64,
ISO 4032 M1.6–M64. DIN 7991 M22/M24 were deliberately omitted because they use a 60° countersink
while the backend only models 90°.

## 5. Tests completed

- `node --check` on `frontend/calculators/nut-bolt/nut-bolt.js` and `backend/calculations/nutBolt.js`: passed.
- `npm test` in `backend`: **71 parity pairs** and thread-system checks passed.
- Live API matrix: all 14 products returned positive weights and finite volumes:
  hex FT/HT/blank, socket, countersunk, carriage, stud FT, double-end stud, threaded rod, hex nut,
  heavy hex nut, jam nut, square nut, lock nut.
- Unit consistency: identical M10×50 hex bolt payload in mm and inch returned
  `0.036640478478581186 kg` and `0.03664047847858118 kg` (delta ≈ `6e−18`).
- Quantity/material checks: quantity 5 gave exactly 5× single weight; stainless, aluminium, brass and
  bronze scaled by their densities as expected.
- DOM smoke test (`AUDIT_SAVED_CODE/nutbolt-dom-smoke.js`): all 14 products rendered 2–3 SVG views with
  5–13 callouts each, no `NaN`/`undefined`, all parsed coordinates inside viewBox bounds. The dedicated
  full-thread hex bolt drawing renders exactly **2 views and 5 uppercase mm callouts**
  (`S = 16.0 mm`, `K = 6.40 mm`, `L = 50.0 mm`, `D = 10.0 mm`, `P = 1.50 mm` for the M10×50 example).
  Unit switching keeps that drawing in millimetres while other products still show `in`/`TPI`, and a
  manual pitch edit updates it to `P = 2.50 mm`.
- CSS responsive rules reviewed statically: multi-view flex wrapping, full-width side view on phones,
  reclaimed card padding, increased touch targets, and horizontal overflow clipping.

## 6. Limitations

- **No real browser run was possible.** The desktop browser was disconnected in this session, so no
  Chrome desktop or mobile screenshot, visual clipping check, label-overlap inspection, or console-error
  capture was performed. Do not claim visual verification.
- Mobile layout was reviewed from CSS and exercised only through the DOM smoke test; it was not tested
  in a real 390 px viewport or on a touch device.
- ISO 7040 nylon insert deduction remains a fixed `1.5 mm`; the exact metal-height derivation was not
  available and was not invented.
- DIN 7991 M22/M24 (60° countersink) are not offered.
- UNF and >1″ UNC ASME rows were not added because verified `s`/`k` dimensions were not available.
- `e` (across corners) is derived from `s` for drawings and geometry; it is not a separate input.
- Standards were verified against the internal audited tables and prior audit notes, not a live
  standards publication.

## 7. Changed files copied to `AUDIT_SAVED_CODE/changed-files`

- `frontend/calculators/nut-bolt/index.html`
- `frontend/calculators/nut-bolt/nut-bolt.css`
- `frontend/calculators/nut-bolt/nut-bolt.js`
- `backend/calculations/nutBolt.js`
- `backend/test/threadFactors.js`

Additional evidence in `AUDIT_SAVED_CODE`: `nutbolt-dom-smoke.js`, `drawing-hex-bolt.html`,
`hex-bolt-full-thread-drawing.html` (self-contained two-view preview),
`hex-bolt-full-thread-drawing.svg` (vector image),
`hex-bolt-full-thread-drawing.png` (2360 × 1080 raster image),
`render_hex_bolt_image.py` (image generator), `drawing-hex-nut.html`, `drawing-stud.html`,
`drawing-countersunk.html`.

Nothing was committed, pushed, reviewed or merged. The workspace is not a git repository.
