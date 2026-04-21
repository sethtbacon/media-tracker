const BASE = "/api";

function buildQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "" && v !== false) {
      q.append(k, v);
    }
  }
  return q.toString();
}

export async function getMedia(filters = {}) {
  const qs = buildQuery(filters);
  const res = await fetch(`${BASE}/media/${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${BASE}/media/stats`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMediaById(id) {
  const res = await fetch(`${BASE}/media/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createMedia(data) {
  const res = await fetch(`${BASE}/media/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateMedia(id, data) {
  const res = await fetch(`${BASE}/media/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteMedia(id) {
  const res = await fetch(`${BASE}/media/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function importCSV(file, replaceAll) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/import/csv?replace_all=${replaceAll}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function exportCSV(filters = {}) {
  const qs = buildQuery(filters);
  window.location.href = `${BASE}/import/export/csv${qs ? "?" + qs : ""}`;
}

export async function fetchMetadataStatus() {
  const res = await fetch(`${BASE}/import/fetch-metadata/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchMissingMetadata(batchSize = 100) {
  const res = await fetch(`${BASE}/import/fetch-metadata?batch_size=${batchSize}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export async function getSettings() {
  const res = await fetch(`${BASE}/settings/`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateSetting(key, value) {
  const res = await fetch(`${BASE}/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function lookupMetadata(title, year) {
  const qs = new URLSearchParams({ title });
  if (year) qs.append("year", year);
  const res = await fetch(`${BASE}/media/lookup?${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Lookup failed" }));
    throw new Error(err.detail || "Lookup failed");
  }
  return res.json();
}

// ── Movie Night ──────────────────────────────────────────────────────────────

export async function createMovieNightSession(body) {
  const res = await fetch(`${BASE}/movie-night/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMovieNightSession(code) {
  const res = await fetch(`${BASE}/movie-night/sessions/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitSwipe(code, body) {
  const res = await fetch(`${BASE}/movie-night/sessions/${encodeURIComponent(code)}/swipe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function endMovieNightSession(code) {
  const res = await fetch(`${BASE}/movie-night/sessions/${encodeURIComponent(code)}/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMovieNightHistory() {
  const res = await fetch(`${BASE}/movie-night/sessions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteMovieNightSession(code) {
  const res = await fetch(`${BASE}/movie-night/sessions/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Lists ─────────────────────────────────────────────────────────────────────

export async function getLists(archived = false) {
  const qs = archived ? "?archived=true" : "";
  const res = await fetch(`${BASE}/lists/${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getList(id) {
  const res = await fetch(`${BASE}/lists/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createList(data) {
  const res = await fetch(`${BASE}/lists/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateList(id, data) {
  const res = await fetch(`${BASE}/lists/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteList(id) {
  const res = await fetch(`${BASE}/lists/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function rematchList(id) {
  const res = await fetch(`${BASE}/lists/${id}/rematch`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addListItem(listId, item) {
  const res = await fetch(`${BASE}/lists/${listId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateListItem(listId, itemId, item) {
  const res = await fetch(`${BASE}/lists/${listId}/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteListItem(listId, itemId) {
  const res = await fetch(`${BASE}/lists/${listId}/items/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function importListCSV(listId, file, mode = "overwrite") {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    `${BASE}/lists/${listId}/import/csv?mode=${encodeURIComponent(mode)}`,
    { method: "POST", body: form }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAllUnownedItems() {
  const res = await fetch(`${BASE}/lists/unowned-items`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── TMDB ──────────────────────────────────────────────────────────────────────

export async function getTMDBSources() {
  const res = await fetch(`${BASE}/lists/sources/tmdb/lists`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.lists || data;
}

export async function previewTMDBList(tmdbListId) {
  const res = await fetch(
    `${BASE}/lists/sources/tmdb/preview?tmdb_list_id=${encodeURIComponent(tmdbListId)}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function importFromTMDB(listId, body) {
  const res = await fetch(`${BASE}/lists/${listId}/import/tmdb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function refreshPosters(listId) {
  const res = await fetch(`${BASE}/lists/${listId}/refresh-posters`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
