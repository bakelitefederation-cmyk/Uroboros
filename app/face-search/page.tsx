"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { FacePicker } from "./face-picker";
import { FaceResults } from "./results";
import { SOURCES, type Face, type Limit, type SourceId, type SourceResult } from "./types";

const MAX_SIDE = 1600;
const RESULT_OPTIONS = [10, 50, 100, 200, 500];

type Prepared = { dataUrl: string; base64: string; width: number; height: number };

async function prepareImage(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return { dataUrl, base64: dataUrl.split(",")[1], width, height };
}

const ERRORS: Record<string, string> = {
  config_error: "На сервере не задан ключ SEARCH4FACES_API_KEY.",
  network_error: "search4faces.com недоступен. Попробуйте позже.",
  invalid_image: "Файл не подходит. Нужен JPEG/PNG до ~8 МБ.",
};

async function callApi<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/face-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(ERRORS[data.error] ?? data.detail ?? "Ошибка запроса. Попробуйте ещё раз.");
  return data as T;
}

export default function FaceSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [image, setImage] = useState<Prepared | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [faces, setFaces] = useState<Face[]>([]);
  const [scale, setScale] = useState(1);
  const [selected, setSelected] = useState(0);
  const [sources, setSources] = useState<SourceId[]>(SOURCES.map((s) => s.id));
  const [hidden, setHidden] = useState(true);
  const [perSource, setPerSource] = useState(100);
  const [results, setResults] = useState<SourceResult[] | null>(null);
  const [limit, setLimit] = useState<Limit>(null);
  const [status, setStatus] = useState<"idle" | "detecting" | "searching">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Нужен файл изображения.");
      return;
    }
    setFileName(file.name);
    setError(null);
    setResults(null);
    setFaces([]);
    setImageId(null);
    setSelected(0);
    setStatus("detecting");
    try {
      const prepared = await prepareImage(file);
      setImage(prepared);
      const data = await callApi<{ imageId: string; faces: Face[]; scale: number }>({
        action: "detect",
        image: prepared.base64,
      });
      if (data.faces.length === 0) {
        setError("Лица на фото не найдены. Попробуйте более чёткий снимок анфас.");
        return;
      }
      setImageId(data.imageId);
      setFaces(data.faces);
      setScale(data.scale || 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обработать фото.");
    } finally {
      setStatus("idle");
    }
  }

  async function handleSearch() {
    if (!imageId || !faces[selected] || sources.length === 0) return;
    setStatus("searching");
    setError(null);
    setResults(null);
    try {
      const data = await callApi<{ bySource: SourceResult[]; limit: Limit }>({
        action: "search",
        imageId,
        face: faces[selected],
        sources,
        hidden,
        results: perSource,
      });
      setResults(data.bySource);
      setLimit(data.limit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка поиска.");
    } finally {
      setStatus("idle");
    }
  }

  function toggleSource(id: SourceId) {
    setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <main className="min-h-screen text-white flex flex-col items-center px-6 py-20">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-sm font-medium transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Домой
      </Link>

      <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/20 rounded-2xl p-8 w-full max-w-4xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-bold mb-1 text-center">Поиск по лицу</h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          {"Через search4faces: VK, OK, TikTok, Clubhouse — по всем базам одновременно"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            {image && faces.length > 0 ? (
              <div className="space-y-3">
                <FacePicker
                  src={image.dataUrl}
                  width={image.width}
                  height={image.height}
                  faces={faces}
                  scale={scale}
                  selected={selected}
                  onSelect={setSelected}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full text-sm text-gray-300 hover:text-white transition"
                >
                  Выбрать другое фото
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className={
                  "cursor-pointer h-full min-h-56 rounded-xl border-2 border-dashed transition flex flex-col items-center justify-center text-center py-10 px-6 " +
                  (dragActive ? "border-white/60 bg-white/5" : "border-white/20 hover:border-white/40")
                }
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.dataUrl} alt="Загруженное фото" className="max-h-40 rounded-lg mb-3" />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-3 text-gray-400" aria-hidden>
                    <circle cx="12" cy="9" r="4" />
                    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
                  </svg>
                )}
                <p className="font-bold">
                  {status === "detecting" ? "Ищу лица на фото..." : fileName ?? "Выбрать фото с лицом"}
                </p>
                {!fileName && <p className="text-sm text-gray-400 mt-1">или перетащите сюда</p>}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <fieldset>
              <legend className="text-sm font-semibold mb-2">Базы поиска</legend>
              <div className="space-y-1.5">
                {SOURCES.map((s) => (
                  <label key={s.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sources.includes(s.id)}
                      onChange={() => toggleSource(s.id)}
                      className="accent-white size-4"
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={hidden}
                onChange={(e) => setHidden(e.target.checked)}
                className="accent-white size-4"
              />
              <span>Включать скрытые и закрытые профили</span>
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Результатов на базу</span>
              <select
                value={perSource}
                onChange={(e) => setPerSource(Number(e.target.value))}
                className="bg-white/5 border border-white/20 rounded-lg px-3 py-1.5 outline-none focus:border-white/50"
              >
                {RESULT_OPTIONS.map((n) => (
                  <option key={n} value={n} className="bg-black">
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleSearch}
              disabled={!imageId || sources.length === 0 || status !== "idle"}
              className="w-full bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
            >
              {status === "searching"
                ? `Ищу по ${sources.length} базам...`
                : faces.length > 1
                  ? `Искать лицо №${selected + 1}`
                  : "Найти профили"}
            </button>

            {limit && (
              <p className="text-xs text-gray-400">
                {`Осталось запросов: ${limit.remaining} из ${limit.limit} · до ${limit.speed}/мин · ключ до ${limit.enddate}`}
              </p>
            )}
            <p className="text-xs text-gray-500">
              {"Каждая база — отдельный запрос к API. Фото отправляется в search4faces для распознавания."}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {results && <FaceResults bySource={results} />}
      </div>
    </main>
  );
}
