export default function StatsBar({ stats, filters = {}, onToggleFilter }) {
  if (!stats) return null;

  const groups = [
    [
      { label: "Total",    value: stats.total,                   filterKey: null },
    ],
    [
      { label: "Movies",   value: stats.movies,                  filterKey: "media_type", filterValue: "Movie" },
      { label: "TV",       value: stats.tv_series,               filterKey: "media_type", filterValue: "TV Series" },
    ],
    [
      { label: "Physical", value: stats.physical_total,          filterKey: null },
      { label: "4K",       value: stats.physical_4k,             filterKey: "physical_4k" },
      { label: "Blu-ray",  value: stats.physical_bluray,         filterKey: "physical_bluray" },
      { label: "DVD",      value: stats.physical_dvd,            filterKey: "physical_dvd" },
    ],
    [
      { label: "Apple TV", value: stats.digital_apple_tv,        filterKey: "digital_apple_tv" },
      { label: "Plex",     value: stats.digital_plex,            filterKey: "digital_plex" },
      { label: "MA",       value: stats.digital_movies_anywhere, filterKey: "digital_movies_anywhere" },
    ],
    [
      { label: "Loaned",   value: stats.loaned_out,              filterKey: "loaned",  warn: stats.loaned_out > 0 },
      { label: "Watched",  value: stats.watched ?? 0,            filterKey: "watched" },
    ],
  ];

  function isActive(card) {
    if (!card.filterKey) return false;
    if (card.filterKey === "media_type") return filters.media_type === card.filterValue;
    return filters[card.filterKey] === true;
  }

  function handleClick(card) {
    if (!card.filterKey || !onToggleFilter) return;
    if (card.filterKey === "media_type") {
      const next = filters.media_type === card.filterValue ? "" : card.filterValue;
      onToggleFilter({ ...filters, media_type: next });
    } else {
      onToggleFilter({ ...filters, [card.filterKey]: !filters[card.filterKey] });
    }
  }

  const elements = [];
  groups.forEach((group, gi) => {
    group.forEach((card) => {
      const active = isActive(card);
      const clickable = !!card.filterKey;
      let cls = "stat-card";
      if (card.warn) cls += " warning";
      if (clickable) cls += " clickable";
      if (active) cls += " active";

      elements.push(
        <div
          key={card.label}
          className={cls}
          onClick={() => handleClick(card)}
          role={clickable ? "button" : undefined}
          tabIndex={clickable ? 0 : undefined}
          onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") handleClick(card); } : undefined}
          title={clickable ? (active ? `Clear ${card.label} filter` : `Filter by ${card.label}`) : undefined}
        >
          <div className="stat-value">{card.value ?? 0}</div>
          <div className="stat-label">{card.label}</div>
        </div>
      );
    });
    if (gi < groups.length - 1) {
      elements.push(<div key={`div-${gi}`} className="stats-divider" />);
    }
  });

  return <div className="stats-bar">{elements}</div>;
}
