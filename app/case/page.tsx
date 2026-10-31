"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ModuleShell from "../components/ModuleShell";
import CaseGraph from "../components/CaseGraph";
import {
  CaseData, CaseNode, loadCase, saveCase, addToCase, extractGraph, parseEntity, nodeId, toMarkdown,
} from "../lib/case";

const TOOL_HREF: Record<string, string> = { rdap: "/rdap", dns: "/dns", subdomains: "/subdomains", "site-check": "/site-check" };
const TOOL_NAME: Record<string, string> = { rdap: "Регистрация", dns: "DNS", subdomains: "Поддомены", "site-check": "Проверка сайта" };
const TYPE_NAME: Record<string, string> = { domain: "Домен", ip: "IP", note: "Заметка" };

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CasePage() {
  const [c, setC] = useState<CaseData>({ nodes: [], edges: [], history: [] });
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"graph" | "items" | "history">("graph");
  const [sel, setSel] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setC(loadCase());
    setReady(true);
  }, []);

  function commit(next: CaseData) {
    setC(next);
    saveCase(next);
  }
  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(null), 2500);
  }

  function addManual() {
    const text = input.trim();
    if (!text) return;
    const { type, value } = parseEntity(text);
    addToCase([{ id: nodeId(type, value), type, value: value.toLowerCase(), source: "вручную" }], []);
    setC(loadCase());
    setInput("");
  }

  function removeNode(id: string) {
    commit({ ...c, nodes: c.nodes.filter((n) => n.id !== id), edges: c.edges.filter((e) => e.from !== id && e.to !== id) });
    setSel(null);
  }
  function setNote(id: string, note: string) {
    commit({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { ...n, note } : n)) });
  }

  // «Развернуть»: запускаем регистрацию и DNS для домена и добавляем результат на граф
  async function expand(n: CaseNode) {
    setBusy(true);
    let added = 0;
    for (const tool of ["rdap", "dns"] as const) {
      try {
        const res = await fetch(`/api/${tool}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: n.value }),
        });
        const data = await res.json();
        if (res.ok && !data.error) {
          const g = extractGraph(tool, data, n.value);
          added += addToCase(g.nodes, g.edges);
        }
      } catch {}
    }
    setC(loadCase());
    setBusy(false);
    flash(added ? `Добавлено новых объектов: ${added}` : "Новых связей не нашлось");
  }

  async function importFile(f: File) {
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.nodes) || !Array.isArray(d.edges)) throw new Error();
      commit({ nodes: d.nodes, edges: d.edges, history: Array.isArray(d.history) ? d.history : [] });
      flash("Дело загружено");
    } catch {
      flash("Файл не похож на дело Uroboros");
    }
  }

  const selected = c.nodes.find((n) => n.id === sel) ?? null;

  return (
    <ModuleShell
      title="Дело"
      subtitle="Находки из модулей, связи между ними и история проверок. Данные хранятся только в этом браузере: сохраняйте дело в файл, чтобы не потерять."
      width="2xl"
    >
      <div className="flex flex-wrap gap-2">
        {([["graph", "Граф"], ["items", `Находки (${c.nodes.length})`], ["history", `История (${c.history.length})`]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={"rounded-full border px-4 py-1.5 text-sm transition-colors " + (tab === id ? "border-[#D4B16A] bg-[#D4B16A]/15 text-[#D4B16A]" : "border-white/15 text-gray-300 hover:border-white/40")}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && <p className="mt-4 text-sm text-[#D4B16A]">{msg}</p>}

      {ready && c.nodes.length === 0 && tab !== "history" && (
        <div className="mt-6 rounded-lg border border-white/10 bg-black/30 px-4 py-4 text-sm text-gray-300">
          Дело пока пустое. Откройте{" "}
          <Link className="underline hover:text-[#D4B16A]" href="/dns">DNS-записи</Link> или{" "}
          <Link className="underline hover:text-[#D4B16A]" href="/rdap">Регистрацию домена</Link>, проверьте домен и нажмите «Добавить в дело». Или добавьте объект вручную на вкладке «Находки».
        </div>
      )}

      {tab === "graph" && c.nodes.length > 0 && (
        <div className="mt-5">
          <CaseGraph nodes={c.nodes} edges={c.edges} selected={sel} onSelect={setSel} />
          <p className="mt-2 text-xs text-gray-500">
            Жёлтые точки — домены, голубые — IP, серые — заметки. Нажмите на точку, чтобы увидеть связи и действия.
          </p>

          {selected && (
            <div className="mt-4 rounded-lg border border-[#D4B16A]/30 bg-[#D4B16A]/[0.06] px-4 py-3">
              <p className="text-sm font-semibold break-all">{selected.value}</p>
              <p className="text-xs text-gray-400">{TYPE_NAME[selected.type]}{selected.source ? ` · источник: ${selected.source}` : ""}</p>
              <textarea
                value={selected.note ?? ""}
                onChange={(e) => setNote(selected.id, e.target.value)}
                placeholder="Заметка к этому объекту"
                rows={2}
                className="mt-3 w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#D4B16A]/70 resize-none"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.type === "domain" && (
                  <>
                    <button disabled={busy} onClick={() => expand(selected)} className="rounded-lg bg-[#D4B16A] px-4 py-2 text-sm font-medium text-black disabled:opacity-50 hover:bg-[#E2C98F] transition">
                      {busy ? "Разворачиваю..." : "Развернуть"}
                    </button>
                    {Object.keys(TOOL_HREF).map((t) => (
                      <Link key={t} href={`${TOOL_HREF[t]}?d=${encodeURIComponent(selected.value)}`} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-[#D4B16A]/60 hover:text-[#D4B16A] transition-colors">
                        {TOOL_NAME[t]}
                      </Link>
                    ))}
                  </>
                )}
                <button onClick={() => removeNode(selected.id)} className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 transition">
                  Удалить
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-500">«Развернуть» запускает регистрацию и DNS для домена и добавляет найденное на граф.</p>
            </div>
          )}
        </div>
      )}

      {tab === "items" && (
        <div className="mt-5">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManual()}
              placeholder="Домен, IP или заметка"
              className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
            />
            <button onClick={addManual} disabled={!input.trim()} className="w-full sm:w-auto bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] transition">
              Добавить
            </button>
          </div>
          <ul className="mt-4 divide-y divide-white/[0.08]">
            {c.nodes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm break-all">{n.value}</p>
                  <p className="text-xs text-gray-500">{TYPE_NAME[n.type]}{n.source ? ` · ${n.source}` : ""}{n.note ? ` · ${n.note}` : ""}</p>
                </div>
                <button onClick={() => removeNode(n.id)} className="shrink-0 text-xs text-gray-500 hover:text-red-300">Удалить</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "history" && (
        <div className="mt-5">
          {c.history.length === 0 ? (
            <p className="text-sm text-gray-400">История пуста. Здесь появляются проверки в модулях доменов.</p>
          ) : (
            <>
              <ul className="divide-y divide-white/[0.08]">
                {c.history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-4 py-2.5">
                    <Link href={`${TOOL_HREF[h.tool] ?? "/"}?d=${encodeURIComponent(h.value)}`} className="text-sm break-all hover:text-[#D4B16A]">
                      {h.value}
                    </Link>
                    <span className="text-xs text-gray-500">{TOOL_NAME[h.tool] ?? h.tool} · {new Date(h.ts).toLocaleString("ru-RU")}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => commit({ ...c, history: [] })} className="mt-3 text-xs text-gray-500 underline hover:text-red-300">
                Очистить историю
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2 border-t border-white/10 pt-5">
        <button onClick={() => download("uroboros-delo.json", JSON.stringify(c, null, 2), "application/json")} disabled={!c.nodes.length} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-[#D4B16A]/60 disabled:opacity-40 transition-colors">
          Сохранить в файл
        </button>
        <button onClick={() => download("uroboros-delo.md", toMarkdown(c), "text/markdown")} disabled={!c.nodes.length} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-[#D4B16A]/60 disabled:opacity-40 transition-colors">
          Выгрузить отчётом
        </button>
        <button
          onClick={async () => { try { await navigator.clipboard.writeText(toMarkdown(c)); flash("Скопировано"); } catch {} }}
          disabled={!c.nodes.length}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-[#D4B16A]/60 disabled:opacity-40 transition-colors"
        >
          Копировать отчёт
        </button>
        <label className="cursor-pointer rounded-lg border border-white/15 px-4 py-2 text-sm hover:border-[#D4B16A]/60 transition-colors">
          Загрузить из файла
          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
        <button
          onClick={() => { if (confirm("Удалить все находки, связи и историю из этого браузера?")) { commit({ nodes: [], edges: [], history: [] }); setSel(null); } }}
          disabled={!c.nodes.length && !c.history.length}
          className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40 transition"
        >
          Очистить всё
        </button>
      </div>
    </ModuleShell>
  );
}
