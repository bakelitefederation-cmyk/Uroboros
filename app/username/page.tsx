"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

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
  const [copied, setCopied] = useState(false);

  function copyResults() {
    if (!result || result.results.length === 0) return;
    const text =
      `Ник: ${result.username}\n` +
      `Найдено: ${result.foundCount} из ${result.totalChecked}\n\n` +
      result.results.map((r) => `${r.site}: ${r.url}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function search() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);

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
    <ModuleShell title={"Поиск по нику"} subtitle={"Проверка ~400 сайтов по базе Sherlock. Может занять до минуты."} width="xl">

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="никнейм"
            className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
          />
          <button
            onClick={search}
            disabled={loading || username.trim().length < 2}
            className="w-full sm:w-auto bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
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
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">
                Найдено {result.foundCount} из {result.totalChecked} проверенных сайтов
              </p>
              {result.results.length > 0 && (
                <button
                  onClick={copyResults}
                  className="text-xs bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg px-3 py-1.5 transition"
                >
                  {copied ? "Скопировано" : "Копировать всё"}
                </button>
              )}
            </div>

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
      </ModuleShell>
  );
}
