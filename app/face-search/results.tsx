"use client";
import { useMemo, useState } from "react";
import { sourceLabel, type MergedProfile, type SourceId, type SourceResult } from "./types";

function mergeProfiles(bySource: SourceResult[]): MergedProfile[] {
  const map = new Map<string, MergedProfile>();
  for (const src of bySource) {
    for (const p of src.profiles) {
      const key = p.profile || p.face || `${p.firstName}-${p.lastName}-${p.score}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...p, databases: [p.database], matches: 1 });
        continue;
      }
      existing.matches += 1;
      if (!existing.databases.includes(p.database)) existing.databases.push(p.database);
      if (p.score > existing.score) {
        Object.assign(existing, { ...p, databases: existing.databases, matches: existing.matches });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: MergedProfile[]) {
  const header = ["score", "first_name", "last_name", "maiden_name", "age", "city", "country", "profile", "photo", "source_image", "face", "databases"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.score, r.firstName, r.lastName, r.maidenName, r.age ?? "", r.city, r.country, r.profile, r.photo, r.sourceImage, r.face, r.databases.join("|")]
      .map(esc)
      .join(","),
  );
  return "\uFEFF" + [header.join(","), ...lines].join("\n");
}

function scoreColor(score: number) {
  if (score >= 85) return "bg-green-400";
  if (score >= 70) return "bg-yellow-400";
  return "bg-gray-400";
}

export function FaceResults({ bySource }: { bySource: SourceResult[] }) {
  const [minScore, setMinScore] = useState(0);
  const [activeDb, setActiveDb] = useState<SourceId | "all">("all");
  const [query, setQuery] = useState("");

  const merged = useMemo(() => mergeProfiles(bySource), [bySource]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter((p) => {
      if (p.score < minScore) return false;
      if (activeDb !== "all" && !p.databases.includes(activeDb)) return false;
      if (q) {
        const hay = `${p.firstName} ${p.lastName} ${p.maidenName} ${p.city} ${p.country} ${p.profile}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [merged, minScore, activeDb, query]);

  const failed = bySource.filter((s) => !s.ok);

  return (
    <section className="mt-8 space-y-5" aria-label="Результаты поиска">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveDb("all")}
          className={
            "rounded-full px-3 py-1 text-xs font-medium border transition " +
            (activeDb === "all" ? "bg-white text-black border-white" : "border-white/20 hover:border-white/50")
          }
        >
          {`Все · ${merged.length}`}
        </button>
        {bySource
          .filter((s) => s.ok)
          .map((s) => (
            <button
              key={s.source}
              type="button"
              onClick={() => setActiveDb(s.source)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium border transition " +
                (activeDb === s.source ? "bg-white text-black border-white" : "border-white/20 hover:border-white/50")
              }
            >
              {`${sourceLabel(s.source)} · ${s.profiles.length}`}
            </button>
          ))}
      </div>

      {failed.length > 0 && (
        <div className="rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30 text-sm space-y-1">
          {failed.map((f) => (
            <p key={f.source}>
              <span className="font-bold">{sourceLabel(f.source)}:</span> {f.error}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Фильтр по имени, городу, ссылке"
          aria-label="Фильтр результатов"
          className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/50"
        />
        <label className="flex items-center gap-3 text-sm text-gray-300">
          <span className="whitespace-nowrap">{`Схожесть от ${minScore}%`}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="accent-white"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => download("faces.csv", toCsv(filtered), "text/csv;charset=utf-8")}
            className="rounded-lg border border-white/20 hover:border-white/50 px-3 py-2 text-xs font-medium transition"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => download("faces.json", JSON.stringify(filtered, null, 2), "application/json")}
            className="rounded-lg border border-white/20 hover:border-white/50 px-3 py-2 text-xs font-medium transition"
          >
            JSON
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        {`Показано ${filtered.length} из ${merged.length} уникальных профилей`}
      </p>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-8">Ничего не найдено по текущим фильтрам.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((p, i) => {
            const name = [p.firstName, p.maidenName, p.lastName].filter(Boolean).join(" ") || "Без имени";
            const place = [p.city, p.country].filter(Boolean).join(", ");
            return (
              <li key={`${p.profile}-${i}`} className="flex gap-4 rounded-xl border border-white/15 bg-white/[0.04] p-4">
                {p.face ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.face}
                    alt={`Лицо: ${name}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-white/5"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-white/5 flex-shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full ${scoreColor(p.score)}`} style={{ width: `${Math.min(p.score, 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold tabular-nums">{`${p.score.toFixed(1)}%`}</span>
                  </div>
                  <p className="font-semibold truncate">
                    {name}
                    {p.age ? <span className="text-gray-400 font-normal">{`, ${p.age}`}</span> : null}
                  </p>
                  {place && <p className="text-xs text-gray-400 truncate">{place}</p>}
                  <p className="text-xs text-gray-500 truncate">
                    {p.databases.map(sourceLabel).join(" · ")}
                    {p.matches > 1 ? ` · совпадений: ${p.matches}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs font-medium">
                    {p.profile && (
                      <a href={p.profile} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">
                        Профиль
                      </a>
                    )}
                    {p.photo && (
                      <a href={p.photo} target="_blank" rel="noreferrer" className="hover:underline">
                        Фото в профиле
                      </a>
                    )}
                    {p.sourceImage && (
                      <a href={p.sourceImage} target="_blank" rel="noreferrer" className="hover:underline">
                        Оригинал
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
