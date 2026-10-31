"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ModuleShell from "./ModuleShell";
import { normalizeDomain } from "../lib/domain";
import { addToCase, extractGraph, recordHistory } from "../lib/case";

const TOOLS = [
  { id: "rdap", href: "/rdap", label: "Регистрация домена" },
  { id: "dns", href: "/dns", label: "DNS-записи" },
  { id: "subdomains", href: "/subdomains", label: "Поддомены" },
  { id: "site-check", href: "/site-check", label: "Проверка сайта" },
];

export default function DomainTool({
  title,
  subtitle,
  endpoint,
  current,
  keepWww = false,
  render,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  current: string;
  keepWww?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: (data: any, domain: string) => React.ReactNode;
}) {
  const [input, setInput] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const [added, setAdded] = useState<string | null>(null);

  function addCase() {
    const g = extractGraph(current, data, domain);
    const n = addToCase(g.nodes, g.edges);
    setAdded(n > 0 ? `Добавлено объектов: ${n}` : "Всё это уже в деле");
  }

  async function run(value: string) {
    const d = normalizeDomain(value, keepWww);
    if (!d) {
      setError("Введите домен, например example.com");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setAdded(null);
    setDomain(d);
    setInput(d);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) {
        setError(json?.detail || "Не удалось получить данные. Попробуйте ещё раз.");
        return;
      }
      setData(json);
      recordHistory(current, d);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  // Переход из другого модуля: /dns?d=example.com запускает проверку сразу
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try {
      const d = new URLSearchParams(window.location.search).get("d");
      if (d) {
        setInput(d);
        run(d);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModuleShell title={title} subtitle={subtitle} width="xl">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && run(input)}
          placeholder="example.com"
          autoComplete="off"
          autoCapitalize="none"
          className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
        />
        <button
          onClick={() => run(input)}
          disabled={loading || !input.trim()}
          className="w-full sm:w-auto bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
        >
          {loading ? "Проверяю..." : "Проверить"}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
          <p className="font-bold text-sm">{error}</p>
        </div>
      )}

      {data && <div className="mt-6">{render(data, domain)}</div>}

      {data && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={addCase}
            className="rounded-lg border border-[#D4B16A]/50 bg-[#D4B16A]/10 px-4 py-2 text-sm font-medium text-[#D4B16A] hover:bg-[#D4B16A]/20 transition-colors"
          >
            Добавить в дело
          </button>
          {added && (
            <span className="text-sm text-gray-300">
              {added}.{" "}
              <Link href="/case" className="underline hover:text-[#D4B16A]">Открыть дело</Link>
            </span>
          )}
        </div>
      )}

      {data && (
        <div className="mt-8 border-t border-white/10 pt-5">
          <p className="text-sm text-gray-400">Продолжить с этим доменом:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TOOLS.filter((t) => t.id !== current).map((t) => (
              <Link
                key={t.id}
                href={`${t.href}?d=${encodeURIComponent(domain)}`}
                className="rounded-full border border-white/15 px-4 py-2 text-sm hover:border-[#D4B16A]/60 hover:text-[#D4B16A] transition-colors"
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </ModuleShell>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-1.5 border-b border-white/[0.06] last:border-0">
      <dt className="text-gray-400 text-sm">{label}</dt>
      <dd className="text-sm font-medium break-all text-right">{children}</dd>
    </div>
  );
}
