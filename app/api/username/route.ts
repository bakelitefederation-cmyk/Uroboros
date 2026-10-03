// app/api/username/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // на Pro-плане Vercel; на Hobby может урезаться до 10с

const SHERLOCK_DATA_URL =
  'https://raw.githubusercontent.com/sherlock-project/sherlock/master/sherlock_project/resources/data.json';

interface SherlockSite {
  url: string;
  urlMain: string;
  errorType: 'status_code' | 'message' | 'response_url';
  errorMsg?: string | string[];
  errorUrl?: string;
  regexCheck?: string;
}

interface SiteResult {
  site: string;
  url: string;
  found: boolean;
}

let cachedSites: Record<string, SherlockSite> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 час

async function loadSites(): Promise<Record<string, SherlockSite>> {
  if (cachedSites && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSites;
  }
  const res = await fetch(SHERLOCK_DATA_URL);
  if (!res.ok) throw new Error('failed_to_load_sherlock_data');
  const data = await res.json();
  cachedSites = data;
  cachedAt = Date.now();
  return data;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkSite(name: string, site: SherlockSite, username: string): Promise<SiteResult | null> {
  if (site.regexCheck) {
    try {
      const re = new RegExp(site.regexCheck);
      if (!re.test(username)) return null; // юзернейм не подходит под формат этого сайта
    } catch {
      // игнорируем битый regex в данных
    }
  }

  const url = site.url.replace('{}', encodeURIComponent(username));
  const res = await fetchWithTimeout(url, 5000);
  if (!res) return null; // сеть/таймаут — пропускаем, не считаем ни найденным, ни нет

  let found = false;

  if (site.errorType === 'status_code') {
    found = res.status < 400;
  } else if (site.errorType === 'response_url') {
    found = res.url.replace(/\/$/, '') !== (site.errorUrl ?? '').replace(/\/$/, '');
  } else if (site.errorType === 'message') {
    const text = await res.text().catch(() => '');
    const messages = Array.isArray(site.errorMsg) ? site.errorMsg : [site.errorMsg ?? ''];
    const hasError = messages.some((m) => m && text.includes(m));
    found = res.status < 400 && !hasError;
  }

  if (!found) return null;

  return { site: name, url, found: true };
}

// Ограничиваем конкурентность, чтобы не захлебнуться и не словить бан по rate-limit
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export async function POST(request: NextRequest) {
  const { username } = (await request.json()) as { username?: string };

  if (!username || username.trim().length < 2) {
    return NextResponse.json({ error: 'invalid_username' }, { status: 400 });
  }

  let sites: Record<string, SherlockSite>;
  try {
    sites = await loadSites();
  } catch (err) {
    console.error('sherlock data load error:', err);
    return NextResponse.json(
      { error: 'data_load_failed', detail: 'Не удалось загрузить базу сайтов Sherlock' },
      { status: 500 },
    );
  }

  const entries = Object.entries(sites);
  const tasks = entries.map(([name, site]) => () => checkSite(name, site, username.trim()).catch(() => null));

  const rawResults = await runWithConcurrency(tasks, 40);
  const found = rawResults.filter((r): r is SiteResult => r !== null);

  return NextResponse.json({
    username: username.trim(),
    totalChecked: entries.length,
    foundCount: found.length,
    results: found,
  });
}