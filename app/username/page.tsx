"use client";
import { useState } from "react";

type SiteResult = { name: string; url: string; found: boolean };

export default function UsernameCheck() {
  const [username, setUsername] = useState("");
  const [results, setResults] = useState<SiteResult[] | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">Поиск по нику</h1>
      <div className="flex gap-2 w-full max-w-md">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="никнейм"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 outline-none"
        />
        <button
          onClick={checkUsername}
          disabled={loading || !username}
          className="bg-white text-black rounded-lg px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "..." : "Проверить"}
        </button>
      </div>
      {results && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
          {results.map((r) => {
            const cardClass = r.found
              ? "rounded-lg px-4 py-3 border flex justify-between items-center border-green-600 bg-green-950/30"
              : "rounded-lg px-4 py-3 border flex justify-between items-center border-gray-800 bg-gray-900/30 opacity-50";
            return (
              <a key={r.name} href={r.found ? r.url : undefined} target="_blank" className={cardClass}>
                <span>{r.name}</span>
                <span>{r.found ? "найден" : "—"}</span>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}