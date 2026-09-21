"use client";
import { useState } from "react";

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

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold mb-6">Валидация номера</h1>

      <div className="flex gap-2 w-full max-w-md">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+380501234567"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 outline-none"
        />
        <button
          onClick={checkPhone}
          disabled={loading || !phone}
          className="bg-white text-black rounded-lg px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "..." : "Проверить"}
        </button>
      </div>

      {result && (
        <div className="mt-6 text-left bg-gray-900 rounded-lg p-4 w-full max-w-md">
          <p>Валиден: {result.valid ? "✅ да" : "❌ нет"}</p>
          {result.valid && (
            <>
              <p>Страна: {result.country}</p>
              {result.region && <p>Регион: {result.region}</p>}
              {result.city && <p>Город: {result.city}</p>}
              <p>Оператор: {result.carrier}</p>
              <p>Тип линии: {result.type}</p>
              <p>Формат: {result.international}</p>
            </>
          )}
        </div>
      )}
    </main>
  );
}