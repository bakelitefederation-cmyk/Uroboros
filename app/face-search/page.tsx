"use client";

import { useState, ReactNode } from "react";
import Link from "next/link";

const DATABASES = [
  { id: "vk_ok_avatars", label: "Аватары VK и OK" },
  { id: "vk_ok_new", label: "Новые аватары VK и OK" },
  { id: "vk_wall", label: "Фото со стен VK" },
  { id: "tiktok", label: "Аватары TikTok" },
  { id: "clubhouse", label: "Аватары Clubhouse" },
  { id: "sb_photo", label: "База sb_photo" },
];

export default function FaceSearchPage() {
  const [selectedBases, setSelectedBases] = useState<string[]>(
    DATABASES.map((b) => b.id)
  );
  const [includePrivate, setIncludePrivate] = useState(true);
  const [resultsPerBase, setResultsPerBase] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [results, setResults] = useState<any[] | null>(null);

  const toggleBase = (id: string) => {
    setSelectedBases((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMessage(null);
      setResults(null);
    }
  };

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!file || loading) return;

    setLoading(true);
    setErrorMessage(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("collections", JSON.stringify(selectedBases));
      formData.append("limit", resultsPerBase.toString());
      formData.append("includePrivate", includePrivate.toString());

      const res = await fetch("/api/face-search", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMessage(data.error || "Произошла ошибка при поиске.");
      } else {
        setResults(data.results || []);
      }
    } catch (err: any) {
      setErrorMessage("Не удалось отправить запрос к серверу.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6 relative font-sans">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-full border border-zinc-800 text-sm transition-all"
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Домой
      </Link>

      <div className="w-full max-w-4xl bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-8 backdrop-blur-md shadow-2xl">
        <h1 className="text-2xl font-bold text-center mb-1">Поиск по лицу</h1>
        <p className="text-zinc-400 text-xs text-center mb-8">
          Через SERPAPI: VK, OK, TikTok, Clubhouse — по всем базам одновременно
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <label className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer transition-all min-h-[300px] bg-zinc-950/40 relative overflow-hidden">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center">
                <img
                  src={URL.createObjectURL(file)}
                  alt="Превью"
                  className="max-h-48 rounded-lg object-contain mb-3"
                />
                <span className="text-xs text-zinc-300 font-medium truncate max-w-[200px]">
                  {file.name}
                </span>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="font-semibold text-sm mb-1 text-center">
                  Выбрать фото с лицом
                </span>
                <span className="text-xs text-zinc-500">или перетащите сюда</span>
              </>
            )}
          </label>

          <div className="flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-semibold text-zinc-300 block">
                Базы поиска
              </span>

              <div className="space-y-2.5">
                {DATABASES.map((base) => (
                  <label
                    key={base.id}
                    className="flex items-center gap-3 cursor-pointer text-xs text-zinc-300 hover:text-white transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBases.includes(base.id)}
                      onChange={() => toggleBase(base.id)}
                      className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 checked:bg-white text-black focus:ring-0 cursor-pointer"
                    />
                    {base.label}
                  </label>
                ))}
              </div>

              <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer text-xs text-zinc-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={includePrivate}
                    onChange={(e) => setIncludePrivate(e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 checked:bg-white text-black focus:ring-0 cursor-pointer"
                  />
                  Включать скрытые и закрытые профили
                </label>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-zinc-300">
                    Результатов на базу
                  </span>
                  <select
                    value={resultsPerBase}
                    onChange={(e) => setResultsPerBase(Number(e.target.value))}
                    className="bg-zinc-800 border border-zinc-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!file || loading}
                className="w-full py-2.5 bg-zinc-100 hover:bg-white active:bg-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-100 text-black font-semibold text-sm rounded-lg transition-all cursor-pointer"
              >
                {loading ? "Выполняется поиск..." : "Найти профили"}
              </button>
              <p className="text-[10px] text-zinc-500 text-center mt-3">
                Каждая база — отдельный запрос к API. Фото отправляется в Luxand Cloud для распознавания.
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        {results && (
          <div className="mt-8 border-t border-zinc-800 pt-6">
            <h3 className="text-sm font-semibold mb-4">Результаты поиска:</h3>
            {results.length === 0 ? (
              <p className="text-xs text-zinc-400">Совпадений не найдено.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {results.map((item: any, idx: number) => (
                  <div key={idx} className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 flex flex-col items-center">
                    {item.url && (
                      <img src={item.url} alt="Result" className="w-full h-32 object-cover rounded-lg mb-2" />
                    )}
                    <span className="text-xs text-zinc-300 font-medium truncate w-full text-center">
                      {item.name || `Профиль #${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}