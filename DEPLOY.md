# Deployment

The website now has two parts: a static `frontend/` folder and a small Node
`backend/`. The backend also serves the frontend, which is the simplest and
recommended deployment: one process, one origin, no CORS or URL configuration.

## Option 1 — one Node host (recommended)

1. Upload the whole project folder (or at least `frontend/` + `backend/`).
2. Install nothing: the backend has no npm dependencies.
3. Set the environment variables your host needs:

   | Variable | Default | Notes |
   | --- | --- | --- |
   | `PORT` | `8080` | Usually supplied by the host |
   | `HOST` | `127.0.0.1` | Use `0.0.0.0` on most hosts |
   | `NODE_ENV` | `development` | `production` for a live site |
   | `FRONTEND_DIR` | `../frontend` | Only if you move the folder |
   | `PUBLIC_API_BASE` | *(empty)* | Empty = same origin |
   | `ALLOWED_ORIGINS` | *(empty)* | Only for a split deployment |
   | `API_KEY` | *(empty)* | Optional shared key |
   | `RATE_LIMIT_MAX` | `120` | Requests per window, per IP |
   | `RATE_LIMIT_WINDOW_MS` | `60000` | Window length in ms |
   | `MAX_BODY_BYTES` | `16384` | Largest accepted JSON body |

4. Start it with `node backend/server.js` (or `npm start` inside `backend/`).
5. The site answers on `http://<host>:<PORT>/`, the API on `/api/…`.

Any Node host works (VPS, Render, Railway, Fly.io, a shared Node plan). The process
is stateless: no database, no uploads, no writable files.

## Option 2 — static frontend, separate API

1. Upload the **contents of `frontend/`** to the web root of a static host
   (pages keep their relative paths, so `calculators/`, `shared/`, `assets/`,
   `icons/` must sit at the same level as `index.html`).
2. Deploy `backend/` on any Node host and set:
   - `PUBLIC_API_BASE=https://api.example.com` — the browser calls this origin.
   - `ALLOWED_ORIGINS=https://www.example.com` — the site origin(s) allowed to call it.
3. The pages read `PUBLIC_API_BASE` from `/api/bootstrap.js`. With a split origin that
   file is not on the static host, so add one line to each calculator page before
   `assets/js/calc-api.js`:

   ```html
   <meta name="mw-api-base" content="https://api.example.com">
   ```

   `calc-api.js` uses that value (an empty or missing value means same origin).

## What must not be published as static files

`backend/` contains the engineering formulas, validation rules, rate limiting and
configuration. It must be deployed as a running Node service only. When the backend
serves the site itself, this is automatic: the static handler refuses any path
outside `frontend/`.

## After deploying

1. `GET /api/health` returns `{"ok":true,…}`.
2. The home page loads with 23 calculator cards and no console errors.
3. One calculation from a page updates its results (the browser sends
   `POST /api/calculate/…` and gets `200`).
4. `npm test` in `backend/` still passes against the deployed code.

## Updating the site

Replace the files under `frontend/` and restart the backend. Browser caching is
`no-cache` for HTML and revalidation for JS/CSS, so visitors pick up changes on the
next load. The service worker is pass-through and caches no pages.
