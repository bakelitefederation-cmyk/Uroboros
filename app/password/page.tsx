"use client";
import { useState } from "react";

export default function PasswordCheck() {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ found: boolean; count: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkPassword() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold mb-6">Проверка утечки пароля</h1>

      <div className="flex gap-2 w-full max-w-md">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Введите пароль"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 outline-none"
        />
        <button
          onClick={checkPassword}
          disabled={loading || !password}
          className="bg-white text-black rounded-lg px-4 py-2 font-medium disabled:opacity-50"
        >
          {loading ? "..." : "Проверить"}
        </button>
      </div>

      {result && (
        <p className="mt-6 text-lg">
          {result.found
            ? `⚠️ Найден в утечках: ${result.count.toLocaleString()} раз`
            : "✅ Не найден в известных утечках"}
        </p>
      )}
    </main>
  );
}