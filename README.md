# ByteForce-SIH — Manganese Mining Intelligence System

Monorepo for the SIH26009 (MOIL manganese) project: a FastAPI backend serving
two independent ML modules (prospectivity + production shortfall) over a
React/Vite frontend.

```
frontend/   React + Vite + TypeScript + Tailwind UI (TerraScope)
backend/    FastAPI service, ML models, DB scripts (see backend/README.md)
```

## Quick start

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # then edit DATABASE_URL / ADMIN_PASSWORD
docker-compose up -d db        # or point DATABASE_URL at your own Postgres+PostGIS
python scripts/init_db.py
python scripts/import_prospectivity_data.py
uvicorn app.main:app --reload
```
Runs on http://localhost:8000 — Swagger UI at `/docs`, health check at `/api/health`.

Full backend docs (model schemas, API summary, deployment): [backend/README.md](backend/README.md)

### Frontend
```bash
cd frontend
npm install
copy .env.example .env         # VITE_API_BASE_URL=http://localhost:8000/api
npm run dev
```
Runs on http://localhost:3000.

## How frontend and backend connect

They're two independent services, not coupled by folder layout — the frontend
talks to the backend purely over HTTP, using `VITE_API_BASE_URL`
(`frontend/.env`) as the base URL for every `fetch()` call in
`frontend/src/services/api.ts`. The backend's CORS config
(`backend/app/core/config.py`, default `http://localhost:5173,http://localhost:3000`)
already allows the frontend's dev origin.

**Known gap:** `frontend/src/services/api.ts` currently calls routes
(`/auth/login`, `/logs`, `/documents`, `/documents/upload`, `/shortfall/predict`,
`/prospectivity/predict`) that don't match the backend's actual routes
(`/api/prospectivity`, `/api/shortfall`, `/api/upload`, `/api/admin/*`,
`/api/health`, `/api/study-area` — see `backend/app/api/`). One side needs to
be updated before the two are wired together end-to-end.

## Deployment
- `render.yaml` builds the backend from `backend/Dockerfile` with
  `dockerContext: ./backend` (Render blueprint, repo-root `render.yaml`).
  Deployed at https://byteforce-sih-1.onrender.com (2026-09-18).
- `render.yaml` also documents a static-site config for the frontend
  (`rootDir: frontend`, `npm install && npm run build`, publish `dist`) -
  create it in the Render dashboard (New + > Static Site, same repo/branch)
  the same way the backend service was created, since it wasn't set up via
  Blueprint sync. Set `VITE_API_BASE_URL` to the backend URL above at build
  time, then update the backend's `CORS_ORIGINS` env var to the frontend's
  resulting `*.onrender.com` URL and redeploy the backend.
- `docker-compose.yml` (repo root) builds the backend from `./backend` and
  brings up a local Postgres+PostGIS db.
