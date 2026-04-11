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
