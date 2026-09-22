"use client";
import { useState } from "react";
import Link from "next/link";

type PhoneResult = {
  valid: boolean;
  country?: string;
  region?: string;
  city?: string;
  carrier?: string;
  type?: string;
  international?: string;
};

export default function PhoneCheck() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<PhoneResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function checkPhone() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/phone", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  function copyResult() {
    if (!result) return;
    const text = result.valid
      ? "Валиден\nСтрана: " + result.country + "\nРегион: " + (result.region ?? "-") + "\nОператор: " + result.carrier + "\nТип: " + result.type + "\nФормат: " + result.international
      : "Невалиден";
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6">
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
        <h1 className="text-2xl font-bold mb-6 text-center">Валидация номера</h1>

        <div className="flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+380501234567"
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition"
          />
          <button
            onClick={checkPhone}
            disabled={loading || !phone}
            className="bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 transition"
          >
            {loading ? "..." : "Проверить"}
          </button>
        </div>

        {result && (
          <button
            onClick={copyResult}
            className={
              "mt-6 w-full text-left rounded-lg px-4 py-3 transition cursor-pointer " +
              (result.valid
                ? "bg-green-500/10 border border-green-500/30 hover:bg-green-500/20"
                : "bg-red-500/10 border border-red-500/30 hover:bg-red-500/20")
            }
          >
            <p className="font-bold mb-2">{result.valid ? "Валиден" : "Невалиден"}</p>
            {result.valid && (
              <div className="space-y-1 text-sm">
                <p>Страна: <span className="font-bold">{result.country}</span></p>
                {result.region && <p>Регион: <span className="font-bold">{result.region}</span></p>}
                {result.city && <p>Город: <span className="font-bold">{result.city}</span></p>}
                <p>Оператор: <span className="font-bold">{result.carrier}</span></p>
                <p>Тип линии: <span className="font-bold">{result.type}</span></p>
                <p>Формат: <span className="font-bold">{result.international}</span></p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">{copied ? "Скопировано" : "Нажмите, чтобы скопировать"}</p>
          </button>
        )}
      </div>
    </main>
  );
}