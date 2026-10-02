"use client";
import type { Face } from "./types";

type Props = {
  src: string;
  width: number;
  height: number;
  faces: Face[];
  scale: number;
  selected: number;
  onSelect: (index: number) => void;
};

export function FacePicker({ src, width, height, faces, scale, selected, onSelect }: Props) {
  const toPct = (v: number, total: number) => `${((v / scale) / total) * 100}%`;

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Загруженное фото" className="w-full h-auto block" />
        {faces.map((face, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`Выбрать лицо ${i + 1}`}
            aria-pressed={selected === i}
            style={{
              left: toPct(face.x, width),
              top: toPct(face.y, height),
              width: toPct(face.width, width),
              height: toPct(face.height, height),
            }}
            className={
              "absolute rounded-md border-2 transition " +
              (selected === i
                ? "border-green-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
                : "border-white/60 hover:border-white")
            }
          >
            <span className="absolute -top-6 left-0 text-xs font-bold bg-black/70 rounded px-1.5 py-0.5">
              {i + 1}
            </span>
          </button>
        ))}
      </div>
      {faces.length > 1 && (
        <p className="text-xs text-gray-400 text-center">
          {`Найдено лиц: ${faces.length}. Нажмите на рамку, чтобы выбрать нужное.`}
        </p>
      )}
    </div>
  );
}
