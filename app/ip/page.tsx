"use client";
import { useState } from "react";

type IpResult = {
  status: string;
  country?: string;
  city?: string;
  isp?: string;
  org?: string;
  query?: string;
};

export default function IpCheck() {
  const [ip, setIp] = useState("");
  const [result, setResult] = useState<IpResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkIp() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/ip", {
      method: "POST",
      body: JSON.stringify({ ip }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold mb-6">IP-анализ</h1>

      <div className="flex gap-2 w-full max-w-md">
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="8.8.8.8 (пусто = ваш IP)"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 outline-none"
        />
        <button
          onClick={checkIp}
          disabled={loading}
          className="bg-white text-black rounded-lg px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "..." : "Проверить"}
        </button>
      </div>

      {result && (
        <div className="mt-6 text-left bg-gray-900 rounded-lg p-4 w-full max-w-md">
          {result.status === "success" ? (
            <>
              <p>IP: {result.query}</p>
              <p>Страна: {result.country}</p>
              <p>Город: {result.city}</p>
              <p>Провайдер: {result.isp}</p>
              <p>Организация: {result.org}</p>
            </>
          ) : (
            <p>❌ Не удалось определить</p>
          )}
        </div>
      )}
    </main>
  );
}