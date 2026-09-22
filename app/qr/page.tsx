"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import jsQR from "jsqr";

export default function QrCheck() {
  const [result, setResult] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setNotFound(false);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        setResult(code.data);
      } else {
        setNotFound(true);
      }
    };
    img.src = URL.createObjectURL(file);
  }

  function copyResult() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const isUrl = result?.startsWith("http://") || result?.startsWith("https://");

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
        <h1 className="text-2xl font-bold mb-6 text-center">QR-анализатор</h1>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-xl p-8 mb-2 cursor-pointer hover:border-white/40 hover:bg-white/5 transition gap-2">
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <span className="font-bold text-sm mt-1">Выбрать файл</span>
          <span className="text-xs text-gray-400">или перетащите сюда</span>
        </label>

        <canvas ref={canvasRef} className="hidden" />

        {result && (
          <button
            onClick={copyResult}
            className="w-full text-left bg-black/40 border border-white/10 rounded-lg px-4 py-3 mt-4 hover:bg-black/60 transition cursor-pointer break-words"
          >
            <p className="text-gray-400 mb-1 text-sm">Содержимое QR-кода:</p>
            <p className={`font-bold ${isUrl ? "text-yellow-400" : ""}`}>{result}</p>
            {isUrl && (
              <p className="text-gray-500 text-xs mt-2">
                Это ссылка — проверьте домен перед переходом вручную.
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">{copied ? "Скопировано" : "Нажмите, чтобы скопировать"}</p>
          </button>
        )}

        {notFound && (
          <p className="text-center font-bold text-gray-400 mt-4">QR-код не найден на изображении</p>
        )}
      </div>
    </main>
  );
}