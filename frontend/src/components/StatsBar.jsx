export default function StatsBar({ stats }) {
  if (!stats) return null;

  const cards = [
    { label: "Total",    value: stats.total },
    { label: "Movies",   value: stats.movies },
    { label: "TV",       value: stats.tv_series },
    { label: "Physical", value: stats.physical_total },
    { label: "4K",       value: stats.physical_4k },
    { label: "Blu-ray",  value: stats.physical_bluray },
    { label: "DVD",      value: stats.physical_dvd },
    { label: "Apple TV", value: stats.digital_apple_tv },
    { label: "Plex",     value: stats.digital_plex },
    { label: "MA",       value: stats.digital_movies_anywhere },
    { label: "Loaned",   value: stats.loaned_out, warn: stats.loaned_out > 0 },
  ];

  return (
    <div className="stats-bar">
      {cards.map((c) => (
        <div key={c.label} className={`stat-card${c.warn ? " warning" : ""}`}>
          <div className="stat-value">{c.value ?? 0}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
