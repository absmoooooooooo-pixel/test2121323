METAL WEIGHT CALCULATOR — SAVED AUDIT CODE (FUNCTIONAL + UI)
Location: A:\SAN\P2\WEIGHT CALCU\WEIGHT CALCU

This folder contains a saved copy of all code changed during the functional
audit and the later UI/design consistency audit. The same files are already
applied in the live website files at the project root.

FILES SAVED IN changed-files\ (full final copies):
  backend__calculations__nutBolt.js
  backend__middleware__cors.js
  backend__test__threadFactors.js
  backend__package.json
  frontend__assets__js__calc-api.js
  frontend__calculators__dish-ends__index.html
  frontend__calculators__dish-ends__dish-ends.css
  frontend__calculators__dish-ends__dish-ends.js
  frontend__calculators__nut-bolt__index.html
  frontend__calculators__nut-bolt__nut-bolt.css
  frontend__calculators__nut-bolt__nut-bolt.js

REPORTS IN THIS FOLDER:
  SIDE_BY_SIDE.html    before/after hunks for functional and UI changes
  UI_AUDIT_REPORT.md   full UI/design audit scope, findings and resolution

EVIDENCE IN THIS FOLDER:
  evidence\screenshots\   final desktop + mobile captures for baseline and target pages
  evidence\computed\      final desktop + mobile computed-style captures

FINAL VERIFICATION:
  - backend npm test: PASS (71 parity pairs + thread/lock-nut regression)
  - all 22 section calculators: PASS (batch, inch round-trip, scenario and history harnesses)
  - dish-ends: all 5 types, inch round-trip, custom density, reset and validation: PASS
  - nut-bolt: all 14 products, metric + ASME inch, zero thread length: PASS
  - nut-bolt history: same numbers in mm vs inch produce distinct records: PASS
  - stale-response/invalidation/unit-switch races: PASS
  - homepage: all 25 internal calculator links return 200, no console errors: PASS
  - local API fallback: stale or unreachable API base retries the local backend: PASS
  - CORS: file:// (origin null) and other localhost ports can call the local API: PASS
  - UI interaction check: density toggle, roving tab focus, ARIA panel label: PASS
  - real Chrome desktop (1440x1000) + mobile (390x844): no console errors,
    no horizontal overflow, worked examples render on both target pages: PASS
  - computed-style comparison: all shared UI classes on dish-ends and nut-bolt
    match the baseline plate page at desktop and mobile widths: PASS

NOTE:
  The harness run temporarily used a higher local API rate limit to avoid
  interference between parallel checks. The backend was restarted afterwards
  with default settings; /api/health returned:
  {"ok":true,"service":"metal-weight-calculator-api","calculators":24}

  jsdom dish-end harness logs contain getBBox warnings because jsdom does not
  implement SVG getBBox. Real Chrome checks show no errors. Calculations and
  outputs are unaffected.
