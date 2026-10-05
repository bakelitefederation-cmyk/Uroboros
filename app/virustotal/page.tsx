"use client";
import { useState } from "react";
import Link from "next/link";

type Stats = {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout: number;
};

type ScanResult = {
  url: string;
  stats: Stats;
  cached: boolean;
};

export default function VirusTotalCheck() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/virustotal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.detail || "Не удалось выполнить проверку. Попробуйте позже.");
        return;
      }

      const data: ScanResult = await res.json();
      setResult(data);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const verdict = result
    ? result.stats.malicious > 0
      ? "danger"
      : result.stats.suspicious > 0
      ? "warning"
      : "safe"
    : null;

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6 py-16">
      <Link
        href="/"
        className="fixed top-6 left-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-sm font-medium transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Домой
      </Link>

      <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/20 rounded-2xl p-8 w-full max-w-md shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-bold mb-2 text-center">Проверка ссылки</h1>
        <p className="text-xs text-gray-400 text-center mb-6">Через VirusTotal, 70+ антивирусных движков</p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition text-sm"
          />
          <button
            onClick={check}
            disabled={loading || !url}
            className="w-full sm:w-auto bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
          >
            {loading ? "Сканирую..." : "Проверить"}
          </button>
        </div>

        {loading && (
          <p className="text-xs text-gray-400 mt-3 text-center">
            Сканирование может занять до 20 секунд, если ссылка проверяется впервые
          </p>
        )}

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div
            className={
              "mt-6 rounded-lg px-4 py-3 border " +
              (verdict === "danger"
                ? "bg-red-500/10 border-red-500/30"
                : verdict === "warning"
                ? "bg-yellow-500/10 border-yellow-500/30"
                : "bg-green-500/10 border-green-500/30")
            }
          >
            <p className="font-bold text-sm mb-2">
              {verdict === "danger"
                ? "⚠ Обнаружена угроза"
                : verdict === "warning"
                ? "⚠ Есть подозрения"
                : "✓ Угроз не обнаружено"}
            </p>
            <div className="text-xs space-y-1">
              <p>Вредоносный: {result.stats.malicious}</p>
              <p>Подозрительный: {result.stats.suspicious}</p>
              <p>Безопасный: {result.stats.harmless}</p>
              <p>Не определено: {result.stats.undetected}</p>
            </div>
            {result.cached && (
              <p className="text-xs text-gray-400 mt-2">Результат из предыдущего сканирования VirusTotal</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}