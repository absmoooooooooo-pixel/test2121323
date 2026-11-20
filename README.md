# Metal Weight Calculator

Engineering weight calculators for plates, sections, pipes, bars, cones, spheres,
flanges and dished heads. The project is split into a **frontend** (pages, styles,
drawings, interaction) and a **backend** (engineering formulas, material densities,
validation, API).

The website looks and behaves exactly as before: same design, same calculators,
same numbers, same drawings, same printable reports. Only the calculation work moved
from the browser to the server.

---

## Start the website

Requirements: **Node.js 18 or newer**. There are no npm dependencies to install.

```bash
cd backend
node server.js
```

Then open <http://localhost:8080/>.

The backend serves both the API and the `frontend/` folder, so one command runs the
whole website and every existing URL (`/`, `/calculators/plate/`, `/about/`, …) keeps
working unchanged.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm start` | Same as `node server.js` |
| `npm run dev` | Restarts the server when a backend file changes |
| `npm test` | Runs the calculation parity test (71 scenarios, 23 calculators) |

Change the port or bind address with environment variables, or copy
`backend/.env.example` to `backend/.env` and edit it:

```bash
PORT=3000 HOST=0.0.0.0 node backend/server.js
```

---

## Project structure

```
Metal-Weight-Calculator/
├── frontend/                    # everything the browser loads (no formulas)
│   ├── index.html               # home page
│   ├── about/                   # about page
│   ├── calculators/             # 23 calculators: page + own CSS/JS per folder
│   ├── assets/
│   │   ├── css/, js/            # dashboard script, dashboard data, calc-api.js
│   ├── shared/                  # history, feedback, install popup, connection check
│   ├── icons/, favicon.*, manifest.webmanifest, service-worker.js
│   └── robots.txt, sitemap.xml, ads.txt
│
├── backend/                     # private: never served as static files
│   ├── server.js                # starts the HTTP server
│   ├── app.js                   # routes /api, serves frontend, security headers
│   ├── config.js                # environment configuration (+ .env loader)
│   ├── routes/index.js          # API routing
│   ├── controllers/             # calculation + material endpoints
│   ├── middleware/              # CORS, rate limit, static files, HTTP helpers
│   ├── calculations/            # one module per calculator family + registry
│   ├── core/                    # weight chain (volume → kg) and validation
│   ├── materials/               # material density tables + reference data
│   ├── test/                    # parity test + reference copies of the old pages
│   └── .env.example
│
├── tools/                       # original maintenance scripts (dashboard/SEO data)
├── DEPLOY.md                    # hosting notes
└── BACKUP-before-restructure-2026-11-19.zip
```

---

## How the split works

1. The page reads the user's inputs and validates each field exactly as before
   (the messages and rules are unchanged, they live in the page).
2. The page `POST`s the values to the backend with `assets/js/calc-api.js`.
3. The backend validates the payload again, runs the engineering formula and returns
   the finished numbers.
4. The page renders those numbers with its existing formatting, drawings, history
   entries, print and PDF code.

Material densities are also served by the backend (`/api/bootstrap.js` fills the
existing `<select>` options and the Material Density Reference table), so the tables
have a single source of truth.

The engineering formulas — areas, volumes, surface areas, blank diameters, hole
removal, weights and tonnes — exist **only** in `backend/calculations`.

### API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service check |
| `GET` | `/api/calculators` | Slugs the API serves |
| `GET` | `/api/materials` | Density tables as JSON |
| `GET` | `/api/bootstrap.js` | Densities + API base for the pages |
| `POST` | `/api/calculate/:calculator` | Runs one calculation |

Example:

```bash
curl -X POST http://localhost:8080/api/calculate/plate \
  -H "Content-Type: application/json" \
  -d '{"values":{"width":1000,"thickness":5,"length":2000},"unit":"mm","density":7.85,"quantity":3}'
```

```json
{"ok":true,"calculator":"plate","units":{"dimensions":"mm","density":"g/cm3"},
 "result":{"areaMM2":5000,"volumeMM3":10000000,"volumeM3":0.01,
           "singleWeight":78.5,"totalWeight":235.5,"totalTonnes":0.2355,
           "materialName":"Custom Material"}}
```

Errors are always JSON: `400` invalid input (with the field name), `401` missing API
key when one is configured, `404` unknown calculator, `405` wrong method, `413` body
too large, `429` rate limited, `500` unexpected.

`dish-ends` takes an extra `type` (`flat`, `torispherical`, `ellipsoidal`,
`hemispherical`, `template`) and a density in **kg/m³**; every other calculator uses
**g/cm³**.

---

## Security

- The backend folder is never served: the static handler only resolves paths inside
  `frontend/`, and directory traversal attempts return 404.
- Inputs are validated and range-checked on the server, not just in the browser.
- CORS allows the site's own origin and any origin listed in `ALLOWED_ORIGINS`;
  everything else gets 403.
- `/api/calculate` is rate limited per client IP (`RATE_LIMIT_MAX` per
  `RATE_LIMIT_WINDOW_MS`).
- Request bodies are capped (`MAX_BODY_BYTES`) and only JSON is accepted.
- Optional shared key: set `API_KEY` and the pages must send `x-api-key`; leave it
  empty when the site and API share an origin, as they do by default.
- Configuration comes from the environment (`backend/.env`); no secret is ever
  written into `frontend/`.

---

## Tests

```bash
cd backend
npm test
```

The parity test runs every calculator twice with identical inputs — once with the
pre-restructure page (kept in `backend/test/fixtures/original` as reference material
only) and once with the migrated page calling the API — and compares every rendered
string, the calculation history payload and the result object. The five dish head
types are compared field by field, including the template station table.

Expected result: `calculator/scenario pairs compared: 71` followed by `PASS`.
