"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

type Data = Record<string, unknown>;

const LABELS: Record<string, string> = {
  number: "Номер",
  phone: "Номер",
  valid: "Корректный",
  isValid: "Корректный",
  international: "Международный формат",
  e164: "Формат E.164",
  national: "Национальный формат",
  country: "Страна",
  countryCode: "Код страны",
  callingCode: "Телефонный код",
  region: "Регион",
  carrier: "Оператор",
  operator: "Оператор",
  type: "Тип номера",
  lineType: "Тип линии",
  timezone: "Часовой пояс",
};

function fmt(v: unknown): string {
  if (v === true) return "да";
  if (v === false) return "нет";
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(fmt).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function PhoneCheck() {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    const value = phone.trim();
    if (!value || loading) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) {
        setError(
          typeof json?.detail === "string"
            ? json.detail
            : "Не удалось проверить номер. Введите его в международном формате, например +380501234567."
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

  const known = data ? Object.keys(LABELS).filter((k) => k in data) : [];
  const rest = data ? Object.keys(data).filter((k) => !known.includes(k)) : [];
  const invalid = data && (data.valid === false || data.isValid === false);

  return (
    <ModuleShell
      title="Проверка номера"
      subtitle="Формат, страна и оператор. Вводите номер в международном формате."
      width="md"
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="+380501234567"
          autoComplete="off"
          className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
        />
        <button
          onClick={check}
          disabled={loading || !phone.trim()}
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
            (invalid ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30")
          }
        >
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
        </div>
      )}
    </ModuleShell>
  );
}
