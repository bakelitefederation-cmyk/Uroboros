"use client";
import { useState } from "react";
import ModuleShell from "../components/ModuleShell";

type Aircraft = {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  onGround: boolean;
  lastContact: number;
  mapsUrl: string;
};

type AircraftResult = {
  query: string;
  found: boolean;
  aircraft: Aircraft[];
  note: string;
};

export default function AircraftTracker() {
  const [callsign, setCallsign] = useState("");
  const [result, setResult] = useState<AircraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/aircraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callsign }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.detail || "Не удалось выполнить поиск. Попробуйте позже.");
        return;
      }

      const data: AircraftResult = await res.json();
      setResult(data);
    } catch {
      setError("Ошибка запроса. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModuleShell title={"Отслеживание самолётов"} subtitle={"Поиск по позывному (callsign), только борты в воздухе сейчас"} width="md">

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={callsign}
            onChange={(e) => setCallsign(e.target.value)}
            placeholder="напр. RFF1234 или BAW123"
            className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-4 py-2.5 outline-none focus:border-[#D4B16A]/70 transition text-sm"
          />
          <button
            onClick={search}
            disabled={loading || callsign.trim().length < 2}
            className="w-full sm:w-auto bg-[#D4B16A] text-black rounded-lg px-5 py-2.5 font-medium disabled:opacity-40 hover:bg-[#E2C98F] active:bg-[#C9A45C] transition"
          >
            {loading ? "..." : "Найти"}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-red-500/10 border border-red-500/30">
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}

        {result && !result.found && (
          <div className="mt-6 rounded-lg px-4 py-3 bg-white/5 border border-white/10">
            <p className="text-sm">Борт не найден в воздухе прямо сейчас.</p>
          </div>
        )}

        {result && result.found && (
          <div className="mt-6 space-y-2">
            {result.aircraft.map((ac) => (
              <div
                key={ac.icao24}
                className="rounded-lg px-4 py-3 bg-green-500/10 border border-green-500/30 text-sm space-y-1"
              >
                <p className="font-bold">{ac.callsign || "(без позывного)"}</p>
                <p>ICAO24: <span className="font-mono">{ac.icao24}</span></p>
                <p>Страна регистрации: {ac.originCountry}</p>
                <p>Высота: {ac.altitude != null ? `${Math.round(ac.altitude)} м` : "н/д"}</p>
                <p>Скорость: {ac.velocity != null ? `${Math.round(ac.velocity * 3.6)} км/ч` : "н/д"}</p>
                <p>На земле: {ac.onGround ? "да" : "нет"}</p>
                {ac.mapsUrl && (
                  <a
                    href={ac.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1 text-xs underline hover:no-underline"
                  >
                    Показать на карте →
                  </a>
                )}
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">{result.note}</p>
          </div>
        )}
      </ModuleShell>
  );
}
