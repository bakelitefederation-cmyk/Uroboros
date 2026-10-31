"use client";
import { useState, useRef } from "react";
import ModuleShell from "../components/ModuleShell";

type SearchLinks = {
  google: string;
  yandex: string;
  tineye: string;
  bing: string;
};

type UploadResult = {
  imageUrl: string;
  searchLinks: SearchLinks;
};

export default function ReverseImageSearch() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function setSelectedFile(selected: File) {
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) setSelectedFile(selected);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setSelectedFile(dropped);
  }

  async function handleSearch() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/reverse-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError("Не удалось загрузить изображение. Попробуйте другой файл.");
        return;
      }

      const data: UploadResult = await res.json();
      setResult(data);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const engines = result
    ? [
        { name: "Google Lens", url: result.searchLinks.google },
        { name: "Yandex", url: result.searchLinks.yandex },
        { name: "TinEye", url: result.searchLinks.tineye },
        { name: "Bing", url: result.searchLinks.bing },
      ]
    : [];

  return (
    <ModuleShell title={"Обратный поиск по фото"} width="md">

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={
            "cursor-pointer rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center text-center py-10 px-6 " +
            (dragActive
              ? "border-white/60 bg-white/5"
              : "border-white/20 hover:border-white/40")
          }
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="max-h-40 rounded-lg mb-3" />
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mb-3 text-gray-400"
            >
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
              <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
            </svg>
          )}
          <p className="font-bold">{file ? file.name : "Выбрать файл"}</p>
          {!file && <p className="text-sm text-gray-400 mt-1">или перетащите сюда</p>}
        </div>

        <button
          onClick={handleSearch}
          disabled={!file || loading}
          className="mt-4 w-full bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
        >
          {loading ? "Загружаю..." : "Найти похожие"}
        </button>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-2">
            {engines.map((engine) => (
              <a
                key={engine.name}
                href={engine.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg px-4 py-3 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 active:bg-green-500/30 transition text-sm font-medium"
              >
                Искать через {engine.name} →
              </a>
            ))}
            <p className="text-xs text-gray-400 mt-2">
              Фото временно загружено на публичный хостинг, чтобы поисковики могли его открыть по ссылке.
            </p>
          </div>
        )}
      </ModuleShell>
  );
}
