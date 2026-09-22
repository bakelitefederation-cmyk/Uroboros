"use client";
import { useState } from "react";
import Link from "next/link";
import * as exifr from "exifr";

type ExifResult = Record<string, unknown> | null;

export default function ExifCheck() {
  const [result, setResult] = useState<ExifResult>(null);
  const [fileName, setFileName] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const data = await exifr.parse(file);
    setResult(data || {});
  }

  function copyResult() {
    if (!result) return;
    const lines: string[] = [];
    if (result.Make) lines.push("Камера: " + result.Make + " " + (result.Model ?? ""));
    if (result.DateTimeOriginal) lines.push("Дата съёмки: " + result.DateTimeOriginal);
    if (result.latitude && result.longitude) lines.push("GPS: " + result.latitude + ", " + result.longitude);
    if (result.Software) lines.push("ПО обработки: " + result.Software);
    navigator.clipboard.writeText(lines.join("\n") || "Метаданные не найдены");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <h1 className="text-2xl font-bold mb-6 text-center">EXIF-анализ фото</h1>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl p-8 mb-2 cursor-pointer hover:border-white/40 hover:bg-white/5 transition gap-2">
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <span className="font-bold text-sm mt-1">Выбрать фото</span>
          <span className="text-xs text-gray-400">или перетащите сюда</span>
        </label>

        {result && (
          <button
            onClick={copyResult}
            className="w-full text-left bg-black/40 border border-white/10 rounded-lg px-4 py-3 mt-4 hover:bg-black/60 transition cursor-pointer"
          >
            <p className="text-gray-400 mb-2 text-sm">{fileName}</p>
            {Object.keys(result).length === 0 ? (
              <p className="font-bold">Метаданные не найдены</p>
            ) : (
              <div className="space-y-1 text-sm">
                {result.Make !== undefined && (
                  <p>Камера: <span className="font-bold">{String(result.Make)} {String(result.Model ?? "")}</span></p>
                )}
                {result.DateTimeOriginal !== undefined && (
                  <p>Дата съёмки: <span className="font-bold">{String(result.DateTimeOriginal)}</span></p>
                )}
                {result.latitude !== undefined && result.longitude !== undefined && (
                  <p>GPS: <span className="font-bold">{String(result.latitude)}, {String(result.longitude)}</span></p>
                )}
                {result.Software !== undefined && (
                  <p>ПО обработки: <span className="font-bold">{String(result.Software)}</span></p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">{copied ? "Скопировано" : "Нажмите, чтобы скопировать"}</p>
          </button>
        )}
      </div>
    </main>
  );
}