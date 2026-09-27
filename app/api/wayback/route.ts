// app/api/wayback/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface Snapshot {
  timestamp: string;
  date: string;
  archiveUrl: string;
}

function formatTimestamp(ts: string): string {
  // ts формата YYYYMMDDhhmmss
  const y = ts.slice(0, 4);
  const m = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  const h = ts.slice(8, 10) || '00';
  const min = ts.slice(10, 12) || '00';
  return `${d}.${m}.${y} ${h}:${min}`;
}

export async function POST(request: NextRequest) {
  const { url } = (await request.json()) as { url?: string };

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  // 1. Availability API — есть ли снимок вообще, и ближайший к сегодня
  let latestSnapshot: Snapshot | null = null;
  try {
    const availRes = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
    );
    const availData = await availRes.json();
    const closest = availData?.archived_snapshots?.closest;
    if (closest?.available) {
      latestSnapshot = {
        timestamp: closest.timestamp,
        date: formatTimestamp(closest.timestamp),
        archiveUrl: closest.url,
      };
    }
  } catch (err) {
    console.error('wayback availability error:', err);
  }

  // 2. CDX API — полная история снимков (ограничим последними 30, чтобы не раздувать ответ)
  let history: Snapshot[] = [];
  try {
    const cdxRes = await fetch(
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=30&collapse=timestamp:8`,
    );
    const cdxData = await cdxRes.json();
    // первая строка — заголовки колонок, пропускаем
    const rows: string[][] = Array.isArray(cdxData) ? cdxData.slice(1) : [];
    history = rows.map((row) => {
      const timestamp = row[1];
      return {
        timestamp,
        date: formatTimestamp(timestamp),
        archiveUrl: `https://web.archive.org/web/${timestamp}/${url}`,
      };
    });
  } catch (err) {
    console.error('wayback cdx error:', err);
  }

  return NextResponse.json({
    url,
    hasSnapshots: !!latestSnapshot || history.length > 0,
    latestSnapshot,
    history,
  });
}