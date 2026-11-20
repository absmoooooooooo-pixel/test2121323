# Metal Weight Calculator — UI / Design Consistency Audit

**Date:** 20 Nov 2026  
**Project location:** `A:\SAN\P2\WEIGHT CALCU\WEIGHT CALCU`  
**Audit scope:** all 24 calculators  
**Pages changed:** `frontend/calculators/dish-ends/`, `frontend/calculators/nut-bolt/` only

## 1. Objective and interpretation

The user asked for a complete UI/design consistency pass over all 24 calculators,
with improvements restricted to the “Descent Calculator” and the Nut & Bolt
calculator, and with all changed code saved side by side on the PC.

“Descent Calculator” was interpreted as **`dish-ends` / Dish Ends Calculator**,
which is the page containing the Flat Head section. No other calculator was
modified during this UI pass.

## 2. Baseline used

The 22 untouched calculators were treated as the authoritative design baseline.
The canonical references were:

- `frontend/calculators/plate/`
- `frontend/calculators/circular-plate/`
- `frontend/calculators/flange-plate/`
- `frontend/calculators/shell/`
- `frontend/calculators/box-channel/`
- `frontend/calculators/round-bar/`

Shared stylesheets loaded after the page stylesheet are authoritative:

- `frontend/shared/calculator-info-sections.css`
- `frontend/shared/calculator-sticky-header.css`
- `frontend/shared/unit-switch.css`
- `frontend/shared/mobile-input-viewport.css`

19 of the 22 reference pages load effectively identical shared stylesheets, so
differences in the two target pages were measured against that common pattern.

## 3. Method

1. Source-level inspection of all 24 calculator HTML, CSS and JS files.
2. Comparison of headings, card structure, field labels, inputs, buttons,
   results, formula cards, density tables, FAQ blocks, related links, icons,
   borders, colours and spacing against the baseline.
3. Desktop and mobile rendering captures for `plate`, `flange-plate`,
   `circular-plate`, `shell`, `dish-ends` (Flat Head) and `nut-bolt`.
4. Computed-style capture at desktop and mobile widths.
5. Fixes applied only to the two allowed calculator folders.
6. Functional, formula, drawing, output and responsive regression checks.

## 4. Findings and resolution

| Area | Finding | Resolution |
|---|---|---|
| Formula sections | Nut & Bolt used bespoke `method-step` blocks; Dish Ends mixed ad-hoc labels and notation in example tiles. | Rebuilt both to the shared `plate-info-card` → `plate-example` → `example-values` / `example-step` / `example-result` pattern. |
| Headings | Nut & Bolt used `h3` for Dimensions and inconsistent card headings. | Normalised to baseline `h2` / `.sub-heading` hierarchy and headings such as “Weight Calculation Formula”, “Material Density Reference”, “Frequently Asked Questions”. |
| Worked example | Nut & Bolt had no worked numeric example; Dish Ends example labels were verbose. | Added a static Nut & Bolt M10 × 50 example whose values were generated from the backend formula. Dish Ends labels shortened to the baseline style. |
| Density reference | Nut & Bolt had no density reference card; Dish Ends table used g/cm³ while the form uses kg/m³ without explanation. | Added Nut & Bolt density card with show-all toggle. Added a Dish Ends note explaining `1 g/cm³ = 1,000 kg/m³`. |
| FAQ / help | Nut & Bolt had no FAQ card. | Added eight fastener-specific FAQ entries using the shared `plate-faq-list` pattern. |
| Related calculators | Nut & Bolt list was shorter than baseline related-link cards. | Added related solid-bar calculators. |
| Tabs / accessibility | Nut & Bolt tabs lacked ids, panel association and keyboard roving. | Added `role="tabpanel"`, `aria-labelledby`, `aria-controls`, ids, roving `tabindex` and Arrow/Home/End key handling. |
| Inputs / mobile keyboard | Generated fields always used `enterkeyhint="next"`. | Last field now uses `enterkeyhint="done"` in both target calculators. |
| Mobile layout | Nut & Bolt had local rules that could force horizontal overflow. | Added `min-width:0`, `overflow-wrap:break-word`, clipped `overflow-x`, stacked mobile grids and linked `mobile-input-viewport.css`. |
| Drawing text | Dish Ends drawing dimension text stayed fixed at small desktop sizes. | Added responsive text scaling while keeping SVG geometry and dimensions unchanged. |
| Cache busting | Old CSS/JS versions could be served from browser cache. | Bumped `dish-ends.css?v=9`, `dish-ends.js?v=20`, `nut-bolt.css?v=3`, `nut-bolt.js?v=9`. |
| AdSense placeholders | Missing from the two target pages. | Added the same placeholder comment style used by the other 22 calculators. |
| History presentation | Nut & Bolt history used uppercase KG/LBS and a small inline clear button. | Normalised casing and restyled the history card/button to the shared baseline; added header count badge hooks. |

## 5. Changes applied

### 5.1 `frontend/calculators/dish-ends/`

- `index.html`: shared formula-card structure, standard step block, concise
  example labels, density-unit note, grid fixes, AdSense comments, cache busting.
- `dish-ends.css`: results headings, example grid and responsive drawing text
  sizing aligned to baseline.
- `dish-ends.js`: formula legend/step presentation, example labels,
  `enterkeyhint`, and a fallback heading for the worked example.

### 5.2 `frontend/calculators/nut-bolt/`

- `index.html`: header history count hooks, tab ids/panel association, standard
  formula card, static worked example, density reference card, FAQ card,
  expanded related links, history restyle, AdSense comments, mobile CSS link and
  cache busting.
- `nut-bolt.css`: palette, cards, formula/example/density/FAQ/related styles,
  header and action-row alignment, focus states and mobile safety.
- `nut-bolt.js`: field labels/`enterkeyhint`, tabpanel ARIA, roving tab focus,
  history count badge and casing, density toggle handler.

## 6. Invariants preserved

- No calculation formula, dimension, SVG geometry or output value was changed.
- Nut & Bolt density and worked-example additions are presentation-only.
- The worked example is static HTML; it does not enter the live calculation or
  history queue.
- All prior functional fixes from the earlier audit remain intact.
- The other 22 calculators were not modified.

## 7. Verification

All checks passed:

- `npm test`: 71 parity pairs plus the thread-system / lock-nut regression.
- All 22 standard calculators: batch, inch round-trip, scenario and history
  harnesses.
- Dish Ends: all five types, inch round-trip, custom density, reset and
  validation.
- Nut & Bolt: all 14 products, metric and ASME inch, zero thread length, and
  duplicate-unit history separation.
- Race handling: stale quantity results, cleared inputs and unit switches
  during a pending request.
- API fallback and CORS: unreachable/404 API base retries the local backend;
  local browser origins are permitted in development.
- Homepage: all 25 internal calculator links return HTTP 200.
- UI interaction harness: density toggle rows/`aria-expanded`, roving tab focus
  and `aria-labelledby` on the dimensions panel.
- Real Chrome at 1440×1000 and 390×844: no console errors, no horizontal
  overflow, and worked examples render on both target pages.
- Computed-style comparison: all shared UI classes on the two changed pages
  match the baseline `plate` page at desktop and mobile widths.

jsdom dish-end logs include `getBBox` warnings because jsdom does not implement
SVG `getBBox`; real Chrome reports no errors and all calculation outputs are
correct.

See `SIDE_BY_SIDE.html` for before/after detail, `changed-files\` for full
final copies of every changed file, and `evidence\` for final desktop/mobile
screenshots and computed-style captures.

## 8. Saved code map

`changed-files\` contains the final full copy of every changed file:

- `backend__calculations__nutBolt.js`
- `backend__middleware__cors.js`
- `backend__test__threadFactors.js`
- `backend__package.json`
- `frontend__assets__js__calc-api.js`
- `frontend__calculators__dish-ends__index.html`
- `frontend__calculators__dish-ends__dish-ends.css`
- `frontend__calculators__dish-ends__dish-ends.js`
- `frontend__calculators__nut-bolt__index.html`
- `frontend__calculators__nut-bolt__nut-bolt.css`
- `frontend__calculators__nut-bolt__nut-bolt.js`
