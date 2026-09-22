"use client";
import { useState } from "react";
import Link from "next/link";

export default function PasswordCheck() {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ found: boolean; count: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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

  function copyResult() {
    if (!result) return;
    const text = result.found
      ? "Найден в утечках: " + result.count.toLocaleString() + " раз"
      : "Не найден в известных утечках";
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
        <h1 className="text-2xl font-bold mb-6 text-center">Проверка утечки пароля</h1>

        <div className="flex gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Введите пароль"
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition"
          />
          <button
            onClick={checkPassword}
            disabled={loading || !password}
            className="bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 transition"
          >
            {loading ? "..." : "Проверить"}
          </button>
        </div>

        {result && (
          <button
            onClick={copyResult}
            className={
              "mt-6 w-full text-center rounded-lg px-4 py-3 transition cursor-pointer " +
              (result.found
                ? "bg-red-500/10 border border-red-500/30 hover:bg-red-500/20"
                : "bg-green-500/10 border border-green-500/30 hover:bg-green-500/20")
            }
          >
            <p className="text-lg font-bold">
              {result.found
                ? "Найден в утечках: " + result.count.toLocaleString() + " раз"
                : "Не найден в известных утечках"}
            </p>
            <p className="text-xs text-gray-400 mt-1">{copied ? "Скопировано" : "Нажмите, чтобы скопировать"}</p>
          </button>
        )}
      </div>
    </main>
  );
}