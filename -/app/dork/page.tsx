"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

type Dork = {
  label: string;
  query: string;
};

function buildDorks(site: string, keywords: string): Dork[] {
  const s = site.trim();
  const k = keywords.trim();
  const target = s ? `site:${s}` : "";
  const kw = k ? k : "";

  const combos: Dork[] = [
    {
      label: "Открытые документы (PDF/DOCX/XLSX)",
      query: `${target} filetype:pdf OR filetype:docx OR filetype:xlsx ${kw}`,
    },
    {
      label: "Страницы входа / админ-панели",
      query: `${target} intitle:"login" OR intitle:"admin" OR inurl:admin ${kw}`,
    },
    {
      label: "Открытые директории",
      query: `${target} intitle:"index of" ${kw}`,
    },
    {
      label: "Конфиги и служебные файлы",
      query: `${target} filetype:env OR filetype:log OR filetype:sql OR filetype:bak ${kw}`,
    },
    {
      label: "Упоминания на сторонних сайтах",
      query: `${kw} -site:${s || "example.com"}`,
    },
    {
      label: "Резервные копии и архивы",
      query: `${target} filetype:zip OR filetype:tar OR filetype:sql.gz ${kw}`,
    },
    {
      label: "Конфиденциальные документы",
      query: `${target} intext:"confidential" OR intext:"внутреннее использование" ${kw}`,
    },
    {
      label: "Ключевые слова в заголовке",
      query: `${target} intitle:"${kw || "..."}"`,
    },
  ];

  return combos.map((c) => ({
    ...c,
    query: c.query.replace(/\s+/g, " ").trim(),
  }));
}

export default function DorkGenerator() {
  const [site, setSite] = useState("");
  const [keywords, setKeywords] = useState("");
  const [dorks, setDorks] = useState<Dork[] | null>(null);

  function generate() {
    setDorks(buildDorks(site, keywords));
  }

  return (
    <ModuleShell title={"Google Dork генератор"} width="md">

        <div className="space-y-2">
          <input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Домен (напр. example.com) — необязательно"
            className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
          />
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Ключевые слова — необязательно"
            className="w-full bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
          />
        </div>

        <button
          onClick={generate}
          disabled={!site && !keywords}
          className="mt-3 w-full bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
        >
          Сгенерировать запросы
        </button>

        {dorks && (
          <div className="mt-6 space-y-2">
            {dorks.map((d) => (
              <a
                key={d.label}
                href={`https://www.google.com/search?q=${encodeURIComponent(d.query)}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg px-4 py-3 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 active:bg-green-500/30 transition"
              >
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-gray-400 mt-1 break-all">{d.query}</p>
              </a>
            ))}
          </div>
        )}
      </ModuleShell>
  );
}
