"use client";
import { useState, useRef } from "react";
import jsQR from "jsqr";

export default function QrCheck() {
  const [result, setResult] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
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

  const isUrl = result?.startsWith("http://") || result?.startsWith("https://");

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">QR-анализатор</h1>

      <input
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="mb-6 text-sm file:bg-white file:text-black file:rounded-lg file:px-4 file:py-2 file:border-0"
      />

      <canvas ref={canvasRef} className="hidden" />

      {result && (
        <div className="text-left bg-gray-900 rounded-lg p-4 w-full max-w-md break-words">
          <p className="text-gray-400 mb-2">Содержимое QR-кода:</p>
          <p className={isUrl ? "text-yellow-400" : ""}>{result}</p>
          {isUrl && (
            <p className="text-gray-500 text-sm mt-3">
              ⚠️ Это ссылка — она не открылась автоматически. Проверьте домен перед переходом вручную.
            </p>
          )}
        </div>
      )}

      {notFound && (
        <p className="text-gray-400">QR-код не найден на изображении</p>
      )}
    </main>
  );
}