"use client";
import { useState } from "react";
import Link from "next/link";

type EmailResult = {
  email: string;
  validFormat: boolean;
  domainAcceptsMail: boolean;
  disposable: boolean;
  gravatar: {
    exists: boolean;
    displayName?: string | null;
    profileUrl?: string | null;
  };
};

export default function EmailCheck() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<EmailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function checkEmail() {
    setLoading(true);
    setResult(null);
    setError(false);

    const res = await fetch("/api/check-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      setError(true);
      setLoading(false);
      return;
    }

    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  function copyResult() {
    if (!result) return;
    const text =
      "Email: " + result.email +
      "\nДомен принимает почту: " + (result.domainAcceptsMail ? "да" : "нет") +
      "\nОдноразовая почта: " + (result.disposable ? "да" : "нет") +
      "\nGravatar: " + (result.gravatar.exists ? "найден" : "не найден") +
      (result.gravatar.displayName ? "\nИмя: " + result.gravatar.displayName : "") +
      (result.gravatar.profileUrl ? "\nПрофиль: " + result.gravatar.profileUrl : "");
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
        <h1 className="text-2xl font-bold mb-6 text-center">Поиск по почте</h1>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@mail.com"
            type="email"
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition"
          />
          <button
            onClick={checkEmail}
            disabled={loading || !email}
            className="w-full sm:w-auto bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
          >
            {loading ? "..." : "Проверить"}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">Некорректный формат почты</p>
          </div>
        )}

        {result && (
          <button
            onClick={copyResult}
            className="mt-6 w-full text-left rounded-lg px-4 py-3 transition cursor-pointer bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 active:bg-green-500/30"
          >
            <div className="space-y-1 text-sm">
              <p>Email: <span className="font-bold">{result.email}</span></p>
              <p>Домен принимает почту: <span className="font-bold">{result.domainAcceptsMail ? "да" : "нет"}</span></p>
              <p>Одноразовая почта: <span className="font-bold">{result.disposable ? "да" : "нет"}</span></p>
              <p>Gravatar: <span className="font-bold">{result.gravatar.exists ? "найден" : "не найден"}</span></p>
              {result.gravatar.displayName && (
                <p>Имя: <span className="font-bold">{result.gravatar.displayName}</span></p>
              )}
              {result.gravatar.profileUrl && (
                <p>Профиль: <span className="font-bold break-all">{result.gravatar.profileUrl}</span></p>
              )}
              <p className="text-xs text-gray-400 mt-2">{copied ? "Скопировано" : "Нажмите, чтобы скопировать"}</p>
            </div>
          </button>
        )}
      </div>
    </main>
  );
}