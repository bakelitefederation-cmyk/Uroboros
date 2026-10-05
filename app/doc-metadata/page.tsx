"use client";
import { useState, useRef } from "react";
import Link from "next/link";

type DocMetadata = {
  fileInfo: { name: string; sizeBytes: number; type: string };
  core: Record<string, any>;
  app: Record<string, any>;
};

function Section({ title, data }: { title: string; data: Record<string, any> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg px-4 py-3 bg-black/30 border border-white/10">
      <p className="text-sm font-bold mb-2">{title}</p>
      <div className="space-y-1">
        {entries.map(([key, value]) => (
          <p key={key} className="text-xs text-gray-300 flex justify-between gap-2">
            <span className="text-gray-500">{key}</span>
            <span className="text-right break-all">{String(value)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export default function DocMetadataCheck() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DocMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function setSelectedFile(selected: File) {
    setFile(selected);
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

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("document", file);

    try {
      const res = await fetch("/api/doc-metadata", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.detail || "Не удалось прочитать файл.");
        return;
      }

      const data: DocMetadata = await res.json();
      setResult(data);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const hasMetadata =
    result && (Object.keys(result.core).length > 0 || Object.keys(result.app).length > 0);

  return (
    <main className="min-h-screen text-white flex flex-col items-center px-6 py-16">
      <Link
        href="/"
        className="fixed top-6 left-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-sm font-medium transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Домой
      </Link>

      <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/20 rounded-2xl p-8 w-full max-w-xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-bold mb-2 text-center">Метаданные документа</h1>
        <p className="text-xs text-gray-400 text-center mb-6">PDF, DOCX, PPTX, XLSX</p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.xlsx"
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
            (dragActive ? "border-white/60 bg-white/5" : "border-white/20 hover:border-white/40")
          }
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-3 text-gray-400">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
            <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
          </svg>
          <p className="font-bold">{file ? file.name : "Выбрать файл"}</p>
          {!file && <p className="text-sm text-gray-400 mt-1">или перетащите сюда</p>}
        </div>

        <button
          onClick={analyze}
          disabled={!file || loading}
          className="mt-4 w-full bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
        >
          {loading ? "Анализирую..." : "Показать метаданные"}
        </button>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {result && !hasMetadata && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-white/5 border border-white/10">
            <p className="text-sm">Метаданные не найдены в этом файле.</p>
          </div>
        )}

        {result && hasMetadata && (
          <div className="mt-6 space-y-3">
            <Section
              title="Файл"
              data={{
                Имя: result.fileInfo.name,
                Размер: `${(result.fileInfo.sizeBytes / 1024).toFixed(0)} КБ`,
                Формат: result.fileInfo.type,
              }}
            />
            <Section title="Основные свойства" data={result.core} />
            <Section title="Приложение/статистика" data={result.app} />
          </div>
        )}
      </div>
    </main>
  );
}