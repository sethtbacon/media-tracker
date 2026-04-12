# Media Tracker

A self-hosted media collection management app. Replaces a CSV spreadsheet with a persistent SQLite database and a full CRUD web UI.

## Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Backend   | Python 3.12, FastAPI, SQLAlchemy, SQLite |
| Frontend  | React 18 (Vite), plain CSS              |
| Container | Docker Compose (backend + frontend)     |
| Proxy     | Nginx — `/api/*` proxied to backend     |

---

## Quickstart

### Prerequisites

- Docker + Docker Compose
- The `data/` directory must exist before the first run:

```bash
mkdir data
```

### Start

```bash
docker compose up -d --build
```

Open `http://<host-ip>:7878` in your browser.

---

## Importing Your CSV

1. Open the app in your browser.
2. Check **Replace all** in the header (recommended for first import — clears any existing data).
3. Click **Import CSV** and select your file.
4. The result will show: `Imported 734 · Skipped 0`

### CSV Column Headers

Your CSV must use these exact headers (order doesn't matter):

```
Title, Media_Type, Physical_Bluray, Physical_DVD, Physical_4K, Physical_Notes,
Digital_Apple_TV, Digital_Plex, Digital_Movies_Anywhere, Location, Watched,
Parent1_Rating, Parent2_Rating, Kids_Rating, Loaned_To, Notes, Year, Director,
Genre, Runtime, MPAA_Rating, Plot, Cover_URL, IMDB_ID, TMDB_ID
```

**Boolean columns** accept: `Yes`, `yes`, `true`, `1`, `y` as truthy; blank = false.  
**Numeric columns** (`Year`, `Runtime`, `Parent1_Rating`, `Parent2_Rating`, `Kids_Rating`) handle pandas float-formatted values (e.g. `2003.0`).

---

## Exporting

Click **Export CSV** in the header to download a CSV snapshot of your entire collection.

---

## Backup

```bash
cp data/media.db data/media.db.bak
```

---

## Updates

Pull the latest code and rebuild:

```bash
docker compose up -d --build
```

---

## Configuration

Copy `.env.example` to `.env` to change the port:

```bash
cp .env.example .env
# edit PORT=7878 as needed
```
