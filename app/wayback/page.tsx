"use client";
import { useState } from "react";
import Link from "next/link";

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
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6 py-16">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-sm font-medium transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Домой
      </Link>

      <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/20 rounded-2xl p-8 w-full max-w-md shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-bold mb-6 text-center">Wayback Machine</h1>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition text-sm"
          />
          <button
            onClick={checkWayback}
            disabled={loading || !url}
            className="w-full sm:w-auto bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
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
      </div>
    </main>
  );
}