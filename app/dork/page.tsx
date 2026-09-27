"use client";
import { useState } from "react";
import Link from "next/link";

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
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6 py-16">
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
        <h1 className="text-2xl font-bold mb-6 text-center">Google Dork генератор</h1>

        <div className="space-y-2">
          <input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Домен (напр. example.com) — необязательно"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition text-sm"
          />
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Ключевые слова — необязательно"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition text-sm"
          />
        </div>

        <button
          onClick={generate}
          disabled={!site && !keywords}
          className="mt-3 w-full bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
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
      </div>
    </main>
  );
}