"use client";
import { useState } from "react";
import Link from "next/link";

type SiteResult = {
  site: string;
  url: string;
  found: boolean;
};

type UsernameResult = {
  username: string;
  totalChecked: number;
  foundCount: number;
  results: SiteResult[];
};

export default function UsernameSearch() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<UsernameResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.detail || "Не удалось выполнить поиск. Попробуйте позже.");
        return;
      }

      const data: UsernameResult = await res.json();
      setResult(data);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center px-6 py-16">
      <Link
        href="/"
        className="fixed top-6 left-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-sm font-medium transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Домой
      </Link>

      <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/20 rounded-2xl p-8 w-full max-w-xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-bold mb-2 text-center">Поиск по нику</h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          Проверка ~400 сайтов по базе Sherlock. Может занять до минуты.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="никнейм"
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition text-sm"
          />
          <button
            onClick={search}
            disabled={loading || username.trim().length < 2}
            className="w-full sm:w-auto bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
          >
            {loading ? "Проверяю..." : "Проверить"}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6">
            <p className="text-xs text-gray-400 mb-3">
              Найдено {result.foundCount} из {result.totalChecked} проверенных сайтов
            </p>

            {result.results.length === 0 ? (
              <div className="rounded-lg px-4 py-3 bg-white/5 border border-white/10">
                <p className="text-sm">Профили не найдены ни на одной площадке.</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {result.results.map((r) => (
                  <a
                    key={r.site}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg px-4 py-2.5 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 active:bg-green-500/30 transition text-sm"
                  >
                    <span className="font-bold">{r.site}</span>
                    <span className="block text-xs text-gray-400 break-all">{r.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}