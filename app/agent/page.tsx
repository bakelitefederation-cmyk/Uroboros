"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
};

const TOOL_LABELS: Record<string, string> = {
  ip_lookup: "IP-анализ",
  wayback_check: "Wayback Machine",
  link_scan: "Проверка ссылки",
  aircraft_lookup: "Самолёты",
  geo_links: "Гео-ссылки",
  dork_builder: "Dork-генератор",
};

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.detail || "Не удалось получить ответ. Попробуйте позже.");
        return;
      }

      setMessages([
        ...next,
        { role: "assistant", content: data.reply || "(пустой ответ)", toolsUsed: data.toolsUsed },
      ]);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center px-4 sm:px-6 py-16">
      <Link
        href="/"
        className="fixed top-6 left-6 z-10 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-sm font-medium transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Домой
      </Link>

      <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/20 rounded-2xl p-5 sm:p-8 w-full max-w-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col">
        <h1 className="text-2xl font-bold mb-1 text-center">ИИ-ассистент</h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          Использует модули Uroboros: IP, Wayback, проверка ссылок, самолёты, карты, dorks
        </p>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="rounded-lg px-4 py-3 bg-black/30 border border-white/10 text-sm text-gray-300 space-y-2">
              <p>Примеры запросов:</p>
              <p className="text-xs text-gray-400">• Проверь IP 8.8.8.8 и скажи, кому он принадлежит</p>
              <p className="text-xs text-gray-400">• Есть ли у example.com архивные снимки и когда первый?</p>
              <p className="text-xs text-gray-400">• Безопасна ли ссылка https://example.com?</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[90%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words " +
                  (m.role === "user"
                    ? "bg-white text-black"
                    : "bg-black/40 border border-white/10")
                }
              >
                {m.content}
                {m.toolsUsed && m.toolsUsed.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Использовано: {Array.from(new Set(m.toolsUsed)).map((t) => TOOL_LABELS[t] ?? t).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-3 text-sm bg-black/40 border border-white/10 text-gray-400">
                Думаю и вызываю модули...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="mt-4 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            maxLength={1000}
            placeholder="Задайте вопрос..."
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition text-sm resize-none"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-full sm:w-auto bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
          >
            {loading ? "..." : "Отправить"}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3 text-center">
          Тексты диалога отправляются стороннему ИИ-провайдеру. Не вводите конфиденциальные данные.
        </p>
      </div>
    </main>
  );
}