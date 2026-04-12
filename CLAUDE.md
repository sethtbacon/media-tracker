# Media Tracker — Build Spec for Claude Code

## What You Are Building

A self-hosted media collection management web app.  
Runs in Docker on a home lab (WSL / Portainer).  
Accessible at `http://<host-ip>:7878` (configurable via `.env`).

The owner has a CSV database of 734+ movies and TV items. This app replaces
that CSV with a persistent SQLite database and a full CRUD UI.

---

## Tech Stack

| Layer     | Choice                        |
|-----------|-------------------------------|
| Backend   | Python, FastAPI, SQLAlchemy, SQLite |
| Frontend  | React (Vite), plain CSS (no UI framework) |
| Container | Docker Compose — two services: `backend` + `frontend` |
| Proxy     | Nginx in the frontend container; `/api/*` proxied to backend |

**No TypeScript. No Tailwind. No component libraries.**

---

## Project Layout

```
media-tracker/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── data/                     # gitignored; SQLite file lives here
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── routers/
│       ├── media.py          # CRUD + filtering
│       └── import_export.py  # CSV import/export
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── index.css
        └── components/
            ├── StatsBar.jsx
            ├── FilterBar.jsx
            ├── MediaTable.jsx
            ├── EditModal.jsx
            └── ImportPanel.jsx
```

---

## Database Schema

Single table: `media_items`

| Column                   | Type    | Notes                              |
|--------------------------|---------|------------------------------------|
| id                       | Integer | PK, autoincrement                  |
| title                    | String  | Required, indexed                  |
| media_type               | String  | "Movie" or "TV Series"             |
| year                     | Integer | nullable                           |
| physical_bluray          | Boolean | default false                      |
| physical_dvd             | Boolean | default false                      |
| physical_4k              | Boolean | default false                      |
| physical_notes           | String  | nullable                           |
| digital_apple_tv         | Boolean | default false                      |
| digital_plex             | Boolean | default false                      |
| location                 | String  | nullable — "home", "van", "second location" |
| loaned_to                | String  | nullable                           |
| watched                  | Boolean | default false                      |
| parent1_rating           | Float   | nullable, 0–10 — configurable name in Settings |
| parent2_rating           | Float   | nullable, 0–10 — configurable name in Settings |
| kids_rating              | Float   | nullable, 0–10 — shown only when kids_count > 0 |
| notes                    | Text    | nullable                           |
| director                 | String  | nullable                           |
| genre                    | String  | nullable — comma-separated values  |
| runtime                  | Integer | nullable — minutes                 |
| mpaa_rating              | String  | nullable — G/PG/PG-13/R/NC-17/Not Rated |
| plot                     | Text    | nullable                           |
| cover_url                | String  | nullable                           |
| imdb_id                  | String  | nullable                           |
| tmdb_id                  | String  | nullable                           |

---

## API Endpoints

### Media CRUD

```
GET    /api/media/          List with filters (see below)
GET    /api/media/stats     Collection statistics object
GET    /api/media/{id}      Single item
POST   /api/media/          Create item
PUT    /api/media/{id}      Update item
DELETE /api/media/{id}      Delete item
```

### List Query Parameters (all optional)

- `search` — ilike match on title OR director
- `media_type` — "Movie" | "TV Series"
- `physical_bluray`, `physical_dvd`, `physical_4k` — boolean filter
- `digital_apple_tv`, `digital_plex` — boolean filter
- `location` — ilike match
- `loaned` — boolean; true = loaned_to IS NOT NULL AND != ""
- `watched` — boolean
- `genre` — ilike match
- `mpaa_rating` — exact match
- `skip`, `limit` — pagination (default limit 200)

### Stats Response Shape

```json
{
  "total": 734,
  "movies": 710,
  "tv_series": 24,
  "physical_total": 213,
  "physical_bluray": 52,
  "physical_dvd": 103,
  "physical_4k": 2,
  "digital_apple_tv": 194,
  "digital_plex": 465,
  "loaned_out": 3
}
```

### CSV Import/Export

```
POST /api/import/csv?replace_all=false    multipart/form-data, field "file"
GET  /api/import/export/csv               returns file download
```

Import response:
```json
{ "imported": 734, "skipped": 0, "errors": [] }
```

**Import column mapping** — CSV headers are exactly:
`Title, Media_Type, Physical_Bluray, Physical_DVD, Physical_4K, Physical_Notes,
Digital_Apple_TV, Digital_Plex, Location, Watched,
Parent1_Rating, Parent2_Rating, Kids_Rating, Loaned_To, Notes, Year, Director, Genre, Runtime, MPAA_Rating,
Plot, Cover_URL, IMDB_ID, TMDB_ID`

Boolean columns accept: `Yes`, `yes`, `true`, `1`, `y` as truthy; blank/anything else = false.  
Numeric columns (`Year`, `Runtime`, `Parent1_Rating`, `Parent2_Rating`, `Kids_Rating`) handle float-formatted integers from pandas (e.g. `2003.0`).  
`replace_all=true` deletes all existing rows before inserting.

Export must produce a CSV with the same headers in the same order.

---

## UI — Component Responsibilities

### `StatsBar`
- Horizontal row of stat cards across the top, below the header
- Cards: Total, Movies, TV Series, Physical, 4K, Blu-ray, DVD, Apple TV, Plex, Loaned, Watched
- "Loaned" card highlighted in amber when > 0

### `FilterBar`
- Text input: search (title/director)
- Select: media type (All / Movie / TV Series)
- Select: location (All / home / van / second location)
- Select: MPAA rating (All / G / PG / PG-13 / R / NC-17 / Not Rated)
- Toggle buttons for each format/platform: 4K, Blu-ray, DVD, Apple TV, Plex, Loaned, Watched
  - Active = accent color; inactive = ghost style
- "Clear" button resets all filters

### `MediaTable`
- Sticky header row
- Columns in order: Title, Year, Type, 4K, BD, DVD, ATV, Plex, Location, Loaned To, Genre, Rated, W (watched toggle)
- Boolean format columns shown as colored dots (green = yes, grey = no)
- "Loaned To" shown as amber badge when populated
- Title is clickable → opens EditModal
- Each row has Edit + Delete action buttons
- "Load more" button at bottom when more pages exist

### `EditModal`
- Full-screen overlay, scrollable, max-width ~720px
- Grouped sections: Core, Physical, Digital, Location & Loans, Personal
- Core: title (required), media_type select, year, director, genre, runtime, MPAA rating, IMDB ID, plot textarea
- Physical: checkboxes for 4K/Blu-ray/DVD, physical_notes input
- Digital: checkboxes for Apple TV / Plex
- Location & Loans: location select (home/van/second location), loaned_to text input
- Personal: watched checkbox, per-person ratings (Parent 1, Parent 2, Kids — configurable names from Settings; Kids field shown only when kids_count > 0), notes textarea
- Save / Cancel buttons in sticky footer

### `ImportPanel` (lives in the header)
- "Import CSV" button → triggers hidden file input
- "Export CSV" button → calls export endpoint
- "Replace all" checkbox (labelled clearly — destructive)
- Shows result summary after import: "Imported 734 · Skipped 0"
- Shows error message if import fails

---

## Visual Design

Dark theme. No external CSS frameworks.

```
--bg:           #0f1117
--surface:      #1a1d27
--surface2:     #252836
--border:       #2e3347
--text:         #e2e5f0
--text-muted:   #7b829a
--accent:       #6366f1
--accent-hover: #818cf8
--danger:       #ef4444
--success:      #22c55e
--warning:      #f59e0b
```

- Header is `--surface`, `--border` bottom
- Table rows: transparent, hover → `--surface2`
- Sticky table headers: `--surface` background
- Boolean dots: 8px circle, green (`--success`) for true, grey (`--border`) for false
- Loaned badge: amber
- Physical badge class: blue tint
- Digital badge class: purple tint
- All interactive elements have `transition: background 0.15s`
- Base font: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, 14px

---

## Docker Setup

### `docker-compose.yml`

Two services:
1. `backend` — builds from `./backend`, exposes port 8000 internally only, mounts `./data:/app/data`
2. `frontend` — builds from `./frontend`, publishes `${PORT:-7878}:80`, depends on backend

Environment variable `DATABASE_URL` passed to backend: `sqlite:////app/data/media.db`

### Backend Dockerfile

- Base: `python:3.12-slim`
- `WORKDIR /app`
- Install requirements, copy source
- CMD: `uvicorn main:app --host 0.0.0.0 --port 8000`

### Frontend Dockerfile

- Multi-stage: `node:20-alpine` builds with `npm ci && npm run build`
- Second stage: `nginx:alpine`, copies `dist/` to `/usr/share/nginx/html`
- Copies `nginx.conf` to `/etc/nginx/conf.d/default.conf`

### `nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### `.env.example`

```
PORT=7878
```

---

## Backend Python Dependencies

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
python-multipart==0.0.12
pandas==2.2.3
pydantic==2.9.2
```

---

## Frontend JS Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.8"
  }
}
```

`vite.config.js` must proxy `/api` to `http://localhost:8000` for local dev.

---

## Key Behaviors & Rules

1. **CSV import is the primary data entry path on first run.** It must be robust: handle float-formatted years/runtimes from pandas, handle blank boolean columns correctly, skip rows with no title.

2. **`replace_all` import** deletes all rows before inserting. Used for initial load and full resync.

3. **Pagination**: default 200 rows per page. "Load more" appends next page. Filters reset to page 0.

4. **`data/` directory** must be gitignored. `README.md` must instruct user to `mkdir data` before first `docker compose up`.

5. **CORS**: backend allows all origins (internal network use only).

6. **SQLite `check_same_thread=False`** required in SQLAlchemy engine for FastAPI's async handling.

7. **Delete confirmation**: use `window.confirm()` before deleting a row.

8. **Edit vs Add**: EditModal receives `null` for new item, full item object for edit. Title field is required — show inline error if blank on save.

9. **Export** returns `Content-Disposition: attachment; filename=media_collection.csv`.

10. **Stats** are re-fetched after every import, create, or delete operation.

---

## .gitignore

```
data/
__pycache__/
*.pyc
node_modules/
dist/
.env
*.db
.DS_Store
```

---

## README Must Cover

1. Stack overview
2. `docker compose up -d --build` quickstart
3. `mkdir data` prereq
4. How to import the CSV (Import CSV button → Replace all checked → select file)
5. CSV column header list
6. Backup command: `cp data/media.db data/media.db.bak`
7. Export CSV for snapshots
8. `docker compose up -d --build` for updates
