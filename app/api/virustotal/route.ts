// app/api/virustotal/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface AnalysisStats {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout: number;
}

function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'config_error', detail: 'не задан VIRUSTOTAL_API_KEY' },
      { status: 500 },
    );
  }

  const { url } = (await request.json()) as { url?: string };

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  const headers = { 'x-apikey': apiKey };
  const urlId = toBase64Url(url);

  // 1. Проверяем, не сканировали ли этот URL уже раньше — тогда результат мгновенный
  const existing = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, { headers });

  if (existing.ok) {
    const data = await existing.json();
    const stats: AnalysisStats = data?.data?.attributes?.last_analysis_stats;
    return NextResponse.json({ url, stats, cached: true });
  }

  // 2. Если нет — отправляем на сканирование и ждём результат (с ограничением попыток)
  let submitRes: Response;
  try {
    submitRes = await fetch('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`,
    });
  } catch (err) {
    console.error('virustotal submit network error:', err);
    return NextResponse.json({ error: 'network_error' }, { status: 500 });
  }

  if (!submitRes.ok) {
    const text = await submitRes.text();
    console.error('virustotal submit error:', submitRes.status, text);
    return NextResponse.json(
      { error: 'virustotal_error', detail: `${submitRes.status}: превышен лимит запросов или ошибка API` },
      { status: 500 },
    );
  }

  const submitData = await submitRes.json();
  const analysisId = submitData?.data?.id;

  if (!analysisId) {
    return NextResponse.json({ error: 'no_analysis_id' }, { status: 500 });
  }

  // Поллинг — сканирование занимает время, пробуем несколько раз с паузой
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(3000);
    const analysisRes = await fetch(
      `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
      { headers },
    );
    if (!analysisRes.ok) continue;

    const analysisData = await analysisRes.json();
    const status = analysisData?.data?.attributes?.status;

    if (status === 'completed') {
      const stats: AnalysisStats = analysisData.data.attributes.stats;
      return NextResponse.json({ url, stats, cached: false });
    }
  }

  return NextResponse.json(
    { error: 'timeout', detail: 'Сканирование заняло слишком много времени, попробуйте проверить позже' },
    { status: 504 },
  );
}