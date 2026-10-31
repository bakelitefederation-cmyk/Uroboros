"use client";
import { useState } from "react";
import DomainTool from "../components/DomainTool";

function List({ domain, items, truncated, count }: { domain: string; items: string[]; truncated: boolean; count: number }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(items.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-300">
        Для {domain} поддоменов в журналах сертификатов не нашлось.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Найдено: {count}{truncated ? " (показаны первые 300)" : ""}</p>
        <button onClick={copy} className="text-sm underline underline-offset-2 hover:text-[#D4B16A]">
          {copied ? "Скопировано" : "Копировать все"}
        </button>
      </div>
      <ul className="mt-3 divide-y divide-white/[0.06]">
        {items.map((s) => (
          <li key={s} className="flex flex-wrap items-center justify-between gap-x-4 py-1.5">
            <span className="text-sm break-all">{s}</span>
            <span className="flex gap-3 text-xs text-gray-400">
              <a className="hover:text-[#D4B16A]" href={`/dns?d=${encodeURIComponent(s)}`}>DNS</a>
              <a className="hover:text-[#D4B16A]" href={`/site-check?d=${encodeURIComponent(s)}`}>Сайт</a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <DomainTool
      title="Поддомены"
      subtitle="Адреса вида mail.example.com, найденные в публичных журналах выпущенных сертификатов. У крупных доменов ответ может идти долго."
      endpoint="/api/subdomains"
      current="subdomains"
      render={(d, domain) => (
        <List domain={domain} items={d.subdomains ?? []} truncated={!!d.truncated} count={d.count ?? 0} />
      )}
    />
  );
}
