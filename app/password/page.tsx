"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

type Result = { count: number } | null;

// SHA-1 в браузере: пароль никуда не отправляется целиком
async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export default function PasswordCheck() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const hash = await sha1Hex(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);
      // Серверу уходят только первые 5 символов хеша
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true" },
      });
      if (!res.ok) throw new Error("bad status");
      const text = await res.text();
      let count = 0;
      for (const line of text.split("\n")) {
        const [h, c] = line.trim().split(":");
        if (h === suffix) {
          count = parseInt(c, 10) || 0;
          break;
        }
      }
      setResult({ count });
    } catch {
      setError("Не удалось связаться с базой утечек. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModuleShell
      title="Утечка пароля"
      subtitle="Проверка по базе Pwned Passwords. Пароль не покидает браузер: наружу уходят только 5 символов его хеша."
      width="md"
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 min-w-0 items-center rounded-lg border border-white/15 bg-black/40 focus-within:border-[#D4B16A]/70 transition">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder="Введите пароль"
            autoComplete="off"
            className="w-full min-w-0 bg-transparent px-4 py-2.5 outline-none text-sm"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="px-3 text-xs text-gray-400 hover:text-white transition"
          >
            {show ? "Скрыть" : "Показать"}
          </button>
        </div>
        <button
          onClick={check}
          disabled={loading || !password}
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

      {result && result.count === 0 && (
        <div className="mt-6 rounded-lg px-4 py-3 bg-green-500/10 border border-green-500/30">
          <p className="font-bold text-sm">Этого пароля нет в известных утечках.</p>
          <p className="mt-1 text-xs text-gray-400">
            Это не гарантия безопасности: пароль может быть слабым или утечка ещё не попала в базу.
          </p>
        </div>
      )}

      {result && result.count > 0 && (
        <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
          <p className="font-bold text-sm">
            Пароль найден в утечках: {result.count.toLocaleString("ru-RU")} раз.
          </p>
          <p className="mt-1 text-xs text-gray-300">Не используйте его нигде и смените, если он ваш.</p>
        </div>
      )}
    </ModuleShell>
  );
}