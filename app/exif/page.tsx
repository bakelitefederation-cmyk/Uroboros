"use client";
import { useState } from "react";
import * as exifr from "exifr";

type ExifResult = Record<string, unknown> | null;

export default function ExifCheck() {
  const [result, setResult] = useState<ExifResult>(null);
  const [fileName, setFileName] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const data = await exifr.parse(file);
    setResult(data || {});
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">EXIF-анализ фото</h1>

      <input
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="mb-6 text-sm file:bg-white file:text-black file:rounded-lg file:px-4 file:py-2 file:border-0"
      />

      {result && (
        <div className="text-left bg-gray-900 rounded-lg p-4 w-full max-w-md">
          <p className="text-gray-400 mb-2">{fileName}</p>
          {Object.keys(result).length === 0 ? (
            <p>Метаданные не найдены (удалены или отсутствуют)</p>
          ) : (
            <>
              {result.Make && <p>Камера: {String(result.Make)} {String(result.Model ?? "")}</p>}
              {result.DateTimeOriginal && <p>Дата съёмки: {String(result.DateTimeOriginal)}</p>}
              {result.latitude && result.longitude && (
                <p>GPS: {String(result.latitude)}, {String(result.longitude)}</p>
              )}
              {result.Software && <p>ПО обработки: {String(result.Software)}</p>}
            </>
          )}
        </div>
      )}
    </main>
  );
}