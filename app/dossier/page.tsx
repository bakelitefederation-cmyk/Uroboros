"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

export default function DossierTemplate() {
  const [subject, setSubject] = useState("");
  const [aliases, setAliases] = useState("");
  const [sources, setSources] = useState("");
  const [timeline, setTimeline] = useState("");
  const [findings, setFindings] = useState("");
  const [confidence, setConfidence] = useState("Средний");
  const [conclusion, setConclusion] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toList(text: string): string[] {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function generate() {
    const today = new Date().toLocaleDateString("ru-RU");

    const md = `# Досье: ${subject || "(не указано)"}

**Дата составления:** ${today}
**Уровень достоверности:** ${confidence}

## Известные псевдонимы / альтернативные идентификаторы
${aliases ? toList(aliases).map((a) => `- ${a}`).join("\n") : "_не указаны_"}

## Источники
${sources ? toList(sources).map((s, i) => `${i + 1}. ${s}`).join("\n") : "_не указаны_"}

## Хронология событий
${timeline ? toList(timeline).map((t) => `- ${t}`).join("\n") : "_не указана_"}

## Ключевые находки
${findings ? toList(findings).map((f) => `- ${f}`).join("\n") : "_не указаны_"}

## Вывод
${conclusion || "_не указан_"}

---
*Все сведения основаны исключительно на открытых источниках (OSINT). Каждый пункт следует перепроверять и указывать степень достоверности отдельно.*
`;

    setGenerated(md);
    setCopied(false);
  }

  function copyToClipboard() {
    if (!generated) return;
    navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadMd() {
    if (!generated) return;
    const blob = new Blob([generated], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dossier-${(subject || "untitled").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputClass =
    "w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm";
  const labelClass = "text-xs text-gray-400 mb-1 block";

  return (
    <ModuleShell title={"Шаблон досье"} width="xl">

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Объект (имя / название)</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Псевдонимы / альт. идентификаторы (по одному на строку)</label>
            <textarea value={aliases} onChange={(e) => setAliases(e.target.value)} rows={2} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Источники (по одному на строку)</label>
            <textarea value={sources} onChange={(e) => setSources(e.target.value)} rows={3} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Хронология (напр. "2024-03-01 — регистрация домена")</label>
            <textarea value={timeline} onChange={(e) => setTimeline(e.target.value)} rows={3} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Ключевые находки (по одной на строку)</label>
            <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={3} className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Уровень достоверности</label>
            <select value={confidence} onChange={(e) => setConfidence(e.target.value)} className={inputClass}>
              <option>Низкий</option>
              <option>Средний</option>
              <option>Высокий</option>
              <option>Подтверждённый несколькими источниками</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Вывод</label>
            <textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={3} className={inputClass} />
          </div>
        </div>

        <button
          onClick={generate}
          disabled={!subject}
          className="mt-6 w-full bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
        >
          Сгенерировать досье
        </button>

        {generated && (
          <div className="mt-6">
            <div className="flex gap-2 mb-3">
              <button
                onClick={copyToClipboard}
                className="flex-1 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg px-4 py-2 text-sm transition"
              >
                {copied ? "Скопировано" : "Копировать"}
              </button>
              <button
                onClick={downloadMd}
                className="flex-1 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg px-4 py-2 text-sm transition"
              >
                Скачать .md
              </button>
            </div>
            <pre className="bg-black/40 border border-white/15 rounded-lg p-4 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
              {generated}
            </pre>
          </div>
        )}
      </ModuleShell>
  );
}
