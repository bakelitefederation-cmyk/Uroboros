"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

type Snapshot = {
  timestamp: string;
  date: string;
  archiveUrl: string;
};

type WaybackResult = {
  url: string;
  hasSnapshots: boolean;
  latestSnapshot: Snapshot | null;
  history: Snapshot[];
};

export default function WaybackCheck() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<WaybackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkWayback() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/wayback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        setError("Некорректный URL. Укажите адрес с http:// или https://");
        return;
      }

      const data: WaybackResult = await res.json();
      setResult(data);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModuleShell title={"Wayback Machine"} width="md">

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
          />
          <button
            onClick={checkWayback}
            disabled={loading || !url}
            className="w-full sm:w-auto bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
          >
            {loading ? "..." : "Проверить"}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {result && !result.hasSnapshots && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-white/5 border border-white/10">
            <p className="text-sm">Архивных снимков этой страницы не найдено.</p>
          </div>
        )}

        {result && result.hasSnapshots && (
          <div className="mt-6 space-y-4">
            {result.latestSnapshot && (
              <a
                href={result.latestSnapshot.archiveUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg px-4 py-3 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 active:bg-green-500/30 transition"
              >
                <p className="text-xs text-gray-400 mb-1">Ближайший снимок</p>
                <p className="font-bold text-sm">{result.latestSnapshot.date} →</p>
              </a>
            )}

            {result.history.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  История снимков ({result.history.length})
                </p>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {result.history.map((snap) => (
                    <a
                      key={snap.timestamp}
                      href={snap.archiveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg px-3 py-2 bg-black/30 border border-white/10 hover:bg-white/5 transition text-xs"
                    >
                      {snap.date}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ModuleShell>
  );
}
