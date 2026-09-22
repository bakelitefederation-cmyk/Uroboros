"use client";
import { useState } from "react";
import Link from "next/link";

type SiteResult = { name: string; url: string; found: boolean };

export default function UsernameCheck() {
  const [username, setUsername] = useState("");
  const [results, setResults] = useState<SiteResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function checkUsername() {
    setLoading(true);
    setResults(null);
    const res = await fetch("/api/username", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    setResults(data.results);
    setLoading(false);
  }

  function copyAll() {
    if (!results) return;
    const text = results.filter((r) => r.found).map((r) => r.name + ": " + r.url).join("\n");
    navigator.clipboard.writeText(text || "Ничего не найдено");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center px-6 py-16">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-sm font-medium transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Домой
      </Link>

      <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/20 rounded-2xl p-8 w-full max-w-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-bold mb-6 text-center">Поиск по нику</h1>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="никнейм"
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition"
          />
          <button
            onClick={checkUsername}
            disabled={loading || !username}
            className="bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 transition"
          >
            {loading ? "..." : "Проверить"}
          </button>
        </div>

        {results && (
          <div>
            <button
              onClick={copyAll}
              className="mt-6 w-full text-center text-sm text-gray-400 hover:text-white transition py-2"
            >
              {copied ? "Скопировано" : "Скопировать найденные ссылки"}
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.map((r) => {
                const cardClass = r.found
                  ? "rounded-lg px-4 py-3 border flex justify-between items-center transition border-green-500/30 bg-green-500/10 hover:bg-green-500/20"
                  : "rounded-lg px-4 py-3 border flex justify-between items-center transition border-white/5 bg-white/5 opacity-40";
                return (
                  <a key={r.name} href={r.found ? r.url : undefined} target="_blank" className={cardClass}>
                    <span className="font-bold">{r.name}</span>
                    <span className="text-sm">{r.found ? "найден" : "—"}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}