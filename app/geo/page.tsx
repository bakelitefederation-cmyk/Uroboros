"use client";
import { useState } from "react";
import Link from "next/link";

type GeoLinks = {
  googleMaps: string;
  googleEarth: string;
  yandexMaps: string;
  wikimapia: string;
  sunCalc: string;
};

function buildGeoLinks(lat: string, lng: string): GeoLinks {
  return {
    googleMaps: `https://www.google.com/maps?q=${lat},${lng}`,
    googleEarth: `https://earth.google.com/web/search/${lat},${lng}`,
    yandexMaps: `https://yandex.com/maps/?ll=${lng},${lat}&z=17&pt=${lng},${lat}`,
    wikimapia: `https://wikimapia.org/#lang=en&lat=${lat}&lon=${lng}&z=17`,
    sunCalc: `https://www.suncalc.org/#/${lat},${lng},15/${new Date()
      .toISOString()
      .slice(0, 10)}/12:00/1/3`,
  };
}

function isValidCoord(lat: string, lng: string): boolean {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  return (
    !isNaN(latNum) &&
    !isNaN(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180
  );
}

export default function GeoMultiSearch() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [pasted, setPasted] = useState("");
  const [links, setLinks] = useState<GeoLinks | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSearch() {
    setError(null);
    if (!isValidCoord(lat, lng)) {
      setError("Введите корректные координаты (широта от -90 до 90, долгота от -180 до 180)");
      setLinks(null);
      return;
    }
    setLinks(buildGeoLinks(lat.trim(), lng.trim()));
  }

  function handlePasteParse() {
    // поддержка вставки в формате "50.4501, 30.5234" из EXIF-модуля или карт
    const match = pasted.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    if (match) {
      setLat(match[1]);
      setLng(match[2]);
      setPasted("");
    } else {
      setError("Не удалось распознать координаты во вставленном тексте");
    }
  }

  const tools = links
    ? [
        { name: "Google Maps", url: links.googleMaps },
        { name: "Google Earth", url: links.googleEarth },
        { name: "Yandex Карты", url: links.yandexMaps },
        { name: "Wikimapia", url: links.wikimapia },
        { name: "SunCalc (положение солнца)", url: links.sunCalc },
      ]
    : [];

  return (
    <main className="min-h-screen text-white flex flex-col items-center justify-center px-6">
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
        <h1 className="text-2xl font-bold mb-6 text-center">Гео-мультипоиск</h1>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="Широта (напр. 50.4501)"
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition text-sm"
          />
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="Долгота (напр. 30.5234)"
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-white/30 transition text-sm"
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={!lat || !lng}
          className="w-full bg-white text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-gray-200 active:bg-gray-300 transition"
        >
          Открыть в картах
        </button>

        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-gray-400 mb-2">
            Или вставьте координаты одной строкой (например, из EXIF-модуля):
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="50.4501, 30.5234"
              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-white/30 transition text-sm"
            />
            <button
              onClick={handlePasteParse}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg px-4 py-2 text-sm transition"
            >
              Разобрать
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {links && (
          <div className="mt-6 space-y-2">
            {tools.map((tool) => (
              <a
                key={tool.name}
                href={tool.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg px-4 py-3 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 active:bg-green-500/30 transition text-sm font-medium"
              >
                {tool.name} →
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}