"use client";
import { useState, useRef } from "react";
import ModuleShell from "../components/ModuleShell";

type ExifReport = {
  fileInfo: {
    name: string;
    sizeBytes: number;
    type: string;
    width: number | null;
    height: number | null;
  };
  camera: Record<string, any>;
  dates: Record<string, any>;
  gps: {
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
    direction: number | null;
    timestamp: string | null;
    mapsUrl: string | null;
  };
  software: Record<string, any>;
  iptc: Record<string, any>;
  xmp: Record<string, any>;
  raw: Record<string, any>;
};

function Section({ title, data }: { title: string; data: Record<string, any> }) {
  const entries = Object.entries(data);
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

export default function ExifAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [report, setReport] = useState<ExifReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function setSelectedFile(selected: File) {
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setReport(null);
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
    setReport(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/exif", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError("Не удалось прочитать метаданные. Попробуйте другой файл.");
        return;
      }

      const data: ExifReport = await res.json();
      setReport(data);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const hasAnyMetadata =
    report &&
    (Object.keys(report.camera).length > 0 ||
      Object.keys(report.dates).length > 0 ||
      report.gps.latitude != null ||
      Object.keys(report.software).length > 0 ||
      Object.keys(report.iptc).length > 0 ||
      Object.keys(report.xmp).length > 0);

  return (
    <ModuleShell title={"EXIF фото"} width="xl">

        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

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
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="max-h-40 rounded-lg mb-3" />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-3 text-gray-400">
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
              <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
            </svg>
          )}
          <p className="font-bold">{file ? file.name : "Выбрать файл"}</p>
          {!file && <p className="text-sm text-gray-400 mt-1">или перетащите сюда</p>}
        </div>

        <button
          onClick={analyze}
          disabled={!file || loading}
          className="mt-4 w-full bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
        >
          {loading ? "Анализирую..." : "Показать метаданные"}
        </button>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {report && !hasAnyMetadata && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-white/5 border border-white/10">
            <p className="text-sm">
              Метаданные не найдены — вероятно, файл прошёл через мессенджер/соцсеть, которые их вырезают, либо это скриншот.
            </p>
          </div>
        )}

        {report && hasAnyMetadata && (
          <div className="mt-6 space-y-3">
            <Section
              title="Файл"
              data={{
                Имя: report.fileInfo.name,
                Размер: `${(report.fileInfo.sizeBytes / 1024).toFixed(0)} КБ`,
                Тип: report.fileInfo.type,
                ...(report.fileInfo.width ? { Разрешение: `${report.fileInfo.width}×${report.fileInfo.height}` } : {}),
              }}
            />

            {report.gps.latitude != null && (
              <div className="rounded-lg px-4 py-3 bg-green-500/10 border border-green-500/30">
                <p className="text-sm font-bold mb-2">GPS</p>
                <p className="text-xs">Широта: {report.gps.latitude}</p>
                <p className="text-xs">Долгота: {report.gps.longitude}</p>
                {report.gps.altitude != null && <p className="text-xs">Высота: {report.gps.altitude} м</p>}
                {report.gps.mapsUrl && (
                  <a
                    href={report.gps.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-xs underline hover:no-underline"
                  >
                    Показать на карте →
                  </a>
                )}
              </div>
            )}

            <Section title="Камера" data={report.camera} />
            <Section title="Дата и время" data={report.dates} />
            <Section title="Программное обеспечение" data={report.software} />
            <Section title="IPTC" data={report.iptc} />
            <Section title="XMP" data={report.xmp} />

            <button
              onClick={() => setShowRaw(!showRaw)}
              className="w-full text-xs text-gray-400 underline hover:no-underline"
            >
              {showRaw ? "Скрыть все найденные поля" : "Показать все найденные поля целиком"}
            </button>

            {showRaw && (
              <pre className="bg-black/40 border border-white/15 rounded-lg p-4 text-xs whitespace-pre-wrap max-h-80 overflow-y-auto">
                {JSON.stringify(report.raw, null, 2)}
              </pre>
            )}
          </div>
        )}
      </ModuleShell>
  );
}
