# Architecture & Development Notes

## Tech Stack

| Layer     | Choice                        | Rationale |
|-----------|-------------------------------|-----------|
| Backend   | Python, FastAPI, SQLAlchemy, SQLite | Lightweight, self-hosted friendly, no external DB dependency |
| Frontend  | React (Vite), plain CSS       | No TypeScript, no Tailwind, no component libraries — keep the build simple |
| Container | Docker Compose (two services) | Easy to self-host via Portainer or any Docker host |
| Proxy     | Nginx in frontend container   | `/api/*` proxied to backend; SPA fallback for React routing |

---

## Database Schema

Single table `media_items`. Key design decisions:

- Boolean columns for each physical format (4K/Blu-ray/DVD) and digital platform (Apple TV/Plex/Movies Anywhere) — enables clean filtering without string parsing
- `location` is a free-text field constrained by convention to `home`, `van`, `second location`
- `loaned_to` is nullable; "loaned" filter = `loaned_to IS NOT NULL AND != ""`
- `physical_total` stat = rows where **any** physical boolean is true (a combo pack with Blu-ray+DVD counts as 1, not 2)
- `genre` stored as comma-separated string (e.g. `"Comedy, Drama"`) — simple to display and import/export cleanly

---

## API Design

- All list filters are additive (AND logic)
- `search` does an `ilike` match on both `title` and `director`
- Boolean toggle filters (e.g. `physical_bluray=true`) are only sent when active — absence means "no filter"
- Pagination: `skip`/`limit`, default limit 200. Frontend appends on "Load more", resets to page 0 on filter change
- Stats are re-fetched after every import, create, or delete

### CSV Import Robustness

The import endpoint handles real-world CSV quirks:
- Float-formatted integers from pandas exports (e.g. `2003.0` → `2003`)
- Truthy boolean values: `Yes`, `yes`, `true`, `1`, `y` — anything else is `false`
- Rows with blank titles are skipped (not counted as errors)
- `replace_all=true` deletes all rows before inserting — used for full resyncs

---

## Frontend Architecture

State lives entirely in `App.jsx`. Components receive data and callbacks as props — no global state library.

- **Search debounce**: 400 ms via `useEffect`/`setTimeout` in `FilterBar`
- **Sorting**: client-side only, `useMemo` sort in `MediaTable` — avoids extra round-trips for a collection of this size
- **Pagination**: append-on-load-more, not virtual scroll — simple and works well for hundreds of items
- **EditModal**: handles both create (receives `null`) and edit (receives item object); title field is required with inline error

---

## Docker Setup

```
backend   python:3.12-slim   port 8000 (internal only)
frontend  node:20-alpine → nginx:alpine   port ${PORT:-7878}:80
```

- SQLite file lives in a bind-mounted `./data/` volume — easy to back up with `cp`
- `check_same_thread=False` required in SQLAlchemy engine for FastAPI's thread model
- Frontend Dockerfile is multi-stage: Node builds the Vite bundle, Nginx serves it

---

## Running Locally (without Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # proxies /api → localhost:8000
```

---

## Quality Gate

Pull requests and updates to `main` run three isolated CI jobs:

- Backend compile, fresh-database bootstrap, legacy migration, and HTTP CRUD smoke tests
- Frontend clean install, high-severity dependency audit, and production build
- Docker Compose image builds

The backend checks only use temporary SQLite databases. They do not read or modify
`data/media.db`.

Run the equivalent checks locally from the repository root:

```bash
uv venv .venv
uv pip install --python .venv/bin/python -r backend/requirements.txt
.venv/bin/python -m compileall -q backend scripts
.venv/bin/python scripts/ci_backend_smoke.py
.venv/bin/python scripts/check_repo_hygiene.py
npm ci --prefix frontend
npm audit --prefix frontend --audit-level=high
npm run build --prefix frontend
docker compose config --quiet
docker compose build
```
