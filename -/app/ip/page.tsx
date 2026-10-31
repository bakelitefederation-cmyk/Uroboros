"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

type Data = Record<string, unknown>;

// Подписи для самых частых полей ответа (ip-api и похожих). Остальное покажем как есть.
const LABELS: Record<string, string> = {
  query: "IP",
  ip: "IP",
  country: "Страна",
  countryCode: "Код страны",
  region: "Регион (код)",
  regionName: "Регион",
  city: "Город",
  zip: "Индекс",
  lat: "Широта",
  lon: "Долгота",
  timezone: "Часовой пояс",
  isp: "Провайдер",
  org: "Организация",
  as: "AS",
  asname: "Имя AS",
  mobile: "Мобильная сеть",
  proxy: "VPN / Proxy",
  hosting: "Хостинг / дата-центр",
  reverse: "Обратный DNS",
};

function fmt(v: unknown): string {
  if (v === true) return "да";
  if (v === false) return "нет";
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function IpAnalyzer() {
  const [ip, setIp] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const value = ip.trim();
    if (!value || loading) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) {
        setError(
          typeof json?.detail === "string"
            ? json.detail
            : "Не удалось проверить IP. Проверьте адрес и попробуйте ещё раз."
        );
        return;
      }
      setData(json as Data);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const lat = typeof data?.lat === "number" ? data.lat : null;
  const lon = typeof data?.lon === "number" ? data.lon : null;
  const flagged = data?.proxy === true || data?.hosting === true;

  // Сначала известные поля в удобном порядке, потом остальные
  const known = data ? Object.keys(LABELS).filter((k) => k in data && k !== "ip" || (k === "ip" && "ip" in data && !("query" in data))) : [];
  const rest = data ? Object.keys(data).filter((k) => !known.includes(k) && k !== "status" && k !== "message") : [];

  return (
    <ModuleShell title="IP-анализ" subtitle="Геолокация, провайдер и признаки VPN / Proxy. Геолокация приблизительная: регион, а не адрес." width="md">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="напр. 8.8.8.8"
          inputMode="text"
          autoComplete="off"
          className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
        />
        <button
          onClick={search}
          disabled={loading || !ip.trim()}
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

      {data && (
        <div
          className={
            "mt-6 rounded-lg px-4 py-3 border " +
            (flagged ? "bg-yellow-500/10 border-yellow-500/30" : "bg-green-500/10 border-green-500/30")
          }
        >
          {flagged && (
            <p className="mb-2 text-sm font-semibold">
              Адрес похож на VPN, прокси или дата-центр: реальное местоположение пользователя может отличаться.
            </p>
          )}
          <dl className="space-y-1.5 text-sm">
            {known.map((k) => (
              <div key={k} className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-gray-400">{LABELS[k]}</dt>
                <dd className="font-medium break-all text-right">{fmt(data[k])}</dd>
              </div>
            ))}
            {rest.map((k) => (
              <div key={k} className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-gray-400">{k}</dt>
                <dd className="font-medium break-all text-right">{fmt(data[k])}</dd>
              </div>
            ))}
          </dl>
          {lat !== null && lon !== null && (
            <a
              href={`https://www.google.com/maps?q=${lat},${lon}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm underline underline-offset-2 hover:text-[#D4B16A]"
            >
              Показать на карте →
            </a>
          )}
        </div>
      )}
    </ModuleShell>
  );
}
