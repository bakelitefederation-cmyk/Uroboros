"use client";
import { useState, useRef, useEffect } from "react";
import ModuleShell from "../components/ModuleShell";

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
  domain_registration: "Регистрация домена",
  dns_records: "DNS-записи",
  subdomains: "Поддомены",
  domain_overview: "Обзор домена",
  email_security: "Защита почты домена",
  image_metadata: "EXIF по ссылке",
  document_metadata: "Метаданные документа",
  reverse_image_links: "Обратный поиск фото",
  site_check: "Проверка сайта",
};

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<number | "all" | null>(null);

  async function copyText(text: string, id: number | "all") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  function dialogText() {
    return messages
      .map((m) => (m.role === "user" ? "Вопрос: " : "Ответ: ") + m.content)
      .join("\n\n");
  }

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
    <ModuleShell title={"ИИ-ассистент"} subtitle={"Использует модули Uroboros: домены, DNS, IP, Wayback, проверка ссылок, фото и документы по ссылке, самолёты, карты, dorks"} width="2xl">

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="rounded-lg px-4 py-3 bg-black/30 border border-white/10 text-sm text-gray-300 space-y-2">
              <p>Примеры запросов:</p>
              <p className="text-xs text-gray-400">• Проверь IP 8.8.8.8 и скажи, кому он принадлежит</p>
              <p className="text-xs text-gray-400">• Есть ли у example.com архивные снимки и когда первый?</p>
              <p className="text-xs text-gray-400">• Безопасна ли ссылка https://example.com?</p>
              <p className="text-xs text-gray-400">• Расследуй домен example.com: когда создан, куда указывает, какие поддомены</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  "max-w-[90%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words select-text " +
                  (m.role === "user"
                    ? "bg-[#D4B16A] text-black"
                    : "bg-black/40 border border-white/10")
                }
              >
                {m.content}
                {m.role === "assistant" && (
                  <button
                    onClick={() => copyText(m.content, i)}
                    className="mt-2 block text-xs text-gray-400 underline underline-offset-2 hover:text-[#D4B16A] transition"
                  >
                    {copied === i ? "Скопировано" : "Копировать ответ"}
                  </button>
                )}
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
            className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm resize-none"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-full sm:w-auto bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
          >
            {loading ? "..." : "Отправить"}
          </button>
        </div>

        {messages.length > 0 && (
          <button
            onClick={() => copyText(dialogText(), "all")}
            className="mt-3 self-center text-xs text-gray-400 underline underline-offset-2 hover:text-[#D4B16A] transition"
          >
            {copied === "all" ? "Скопировано" : "Копировать весь диалог"}
          </button>
        )}

        <p className="text-xs text-gray-500 mt-3 text-center">
          Тексты диалога отправляются стороннему ИИ-провайдеру. Не вводите конфиденциальные данные.
        </p>
      </ModuleShell>
  );
}
