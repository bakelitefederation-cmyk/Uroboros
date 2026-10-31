"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

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
    <ModuleShell title={"Проверка ссылки"} subtitle={"Через VirusTotal, 70+ антивирусных движков"} width="md">

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
          />
          <button
            onClick={check}
            disabled={loading || !url}
            className="w-full sm:w-auto bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
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
      </ModuleShell>
  );
}
