// app/api/aircraft/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface AircraftState {
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
}

// Сырой формат ответа OpenSky: массив массивов, порядок полей фиксирован
// [icao24, callsign, origin_country, time_position, last_contact, longitude,
//  latitude, baro_altitude, on_ground, velocity, true_track, ...]
function parseState(row: any[]): AircraftState {
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
    mapsUrl: lat != null && lon != null ? `https://www.google.com/maps?q=${lat},${lon}` : '',
  };
}

export async function POST(request: NextRequest) {
  const { callsign } = (await request.json()) as { callsign?: string };

  if (!callsign || callsign.trim().length < 2) {
    return NextResponse.json({ error: 'invalid_callsign' }, { status: 400 });
  }

  const query = callsign.trim().toUpperCase();

  let res: Response;
  try {
    // Публичный бесплатный эндпоинт, без ключа. Ограничен по частоте запросов
    // (OpenSky даёт анонимным пользователям ограниченное число запросов в день).
    res = await fetch('https://opensky-network.org/api/states/all');
  } catch (networkErr) {
    console.error('opensky network error:', networkErr);
    return NextResponse.json(
      { error: 'network_error', detail: 'OpenSky Network недоступен' },
      { status: 500 },
    );
  }

  if (!res.ok) {
    const text = await res.text();
    console.error('opensky http error:', res.status, text);
    return NextResponse.json(
      { error: 'opensky_error', detail: `${res.status}: превышен лимит запросов или сервис недоступен` },
      { status: 500 },
    );
  }

  const data = await res.json();
  const rows: any[][] = data?.states ?? [];

  const matches = rows
    .filter((row) => (row[1] ?? '').trim().toUpperCase().startsWith(query))
    .map(parseState)
    .slice(0, 10);

  return NextResponse.json({
    query,
    found: matches.length > 0,
    aircraft: matches,
    note: 'Поиск работает только для бортов, находящихся в воздухе прямо сейчас',
  });
}