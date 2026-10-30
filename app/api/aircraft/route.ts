// app/api/aircraft/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface AircraftState {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null; // метры
  velocity: number | null; // м/с
  heading: number | null;
  onGround: boolean;
  lastContact: number;
  mapsUrl: string;
}

const FT_TO_M = 0.3048;
const KT_TO_MS = 0.514444;

function mapsUrl(lat: number | null, lon: number | null) {
  return lat != null && lon != null ? `https://www.google.com/maps?q=${lat},${lon}` : '';
}

// --- Источник 1: adsb.lol / airplanes.live (поиск по позывному, без ключа) ---
async function fromAdsb(query: string): Promise<AircraftState[]> {
  const urls = [
    `https://api.adsb.lol/v2/callsign/${encodeURIComponent(query)}`,
    `https://api.airplanes.live/v2/callsign/${encodeURIComponent(query)}`,
  ];

  let lastErr: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(7000),
        headers: { 'User-Agent': 'Uroboros-OSINT/1.0' },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: any[] = data?.ac ?? [];
      return list.slice(0, 10).map((a) => {
        const onGround = a.alt_baro === 'ground';
        const lat = typeof a.lat === 'number' ? a.lat : null;
        const lon = typeof a.lon === 'number' ? a.lon : null;
        return {
          icao24: a.hex ?? '',
          callsign: (a.flight ?? '').trim(),
          originCountry: a.r ? `рег. ${a.r}${a.t ? ` (${a.t})` : ''}` : (a.t ?? '—'),
          longitude: lon,
          latitude: lat,
          altitude: typeof a.alt_baro === 'number' ? Math.round(a.alt_baro * FT_TO_M) : null,
          velocity: typeof a.gs === 'number' ? Math.round(a.gs * KT_TO_MS) : null,
          heading: typeof a.track === 'number' ? a.track : null,
          onGround,
          lastContact: Math.floor(Date.now() / 1000) - Math.round(a.seen ?? 0),
          mapsUrl: mapsUrl(lat, lon),
        };
      });
    } catch (e) {
      lastErr = e;
      console.error('adsb source failed:', url, e);
    }
  }
  throw lastErr ?? new Error('adsb failed');
}

// --- Источник 2 (запасной): OpenSky. Часто блокирует IP облачных хостингов ---
function parseOpenSky(row: any[]): AircraftState {
  const lat = row[6];
  const lon = row[5];
  return {
    icao24: row[0],
    callsign: (row[1] ?? '').trim(),
    originCountry: row[2],
    longitude: lon,
    latitude: lat,
    altitude: row[7],
    velocity: row[9],
    heading: row[10],
    onGround: row[8],
    lastContact: row[4],
    mapsUrl: mapsUrl(lat, lon),
  };
}

async function fromOpenSky(query: string): Promise<AircraftState[]> {
  const res = await fetch('https://opensky-network.org/api/states/all', {
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);
  const data = await res.json();
  const rows: any[][] = data?.states ?? [];
  return rows
    .filter((row) => (row[1] ?? '').trim().toUpperCase().startsWith(query))
    .map(parseOpenSky)
    .slice(0, 10);
}

export async function POST(request: NextRequest) {
  const { callsign } = (await request.json().catch(() => ({}))) as { callsign?: string };

  if (!callsign || callsign.trim().length < 2) {
    return NextResponse.json({ error: 'invalid_callsign' }, { status: 400 });
  }

  const query = callsign.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (query.length < 2) {
    return NextResponse.json({ error: 'invalid_callsign' }, { status: 400 });
  }

  let aircraft: AircraftState[] | null = null;
  let source = '';

  try {
    aircraft = await fromAdsb(query);
    source = 'adsb.lol / airplanes.live';
  } catch {
    try {
      aircraft = await fromOpenSky(query);
      source = 'OpenSky Network';
    } catch (e) {
      console.error('all aircraft sources failed:', e);
    }
  }

  if (aircraft === null) {
    return NextResponse.json(
      {
        error: 'sources_unavailable',
        detail: 'Сервисы авиаданных сейчас недоступны. Попробуйте через минуту.',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    query,
    found: aircraft.length > 0,
    aircraft,
    source,
    note: 'Поиск работает только для бортов, находящихся в воздухе прямо сейчас',
  });
}