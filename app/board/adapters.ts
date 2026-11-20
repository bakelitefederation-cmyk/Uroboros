// app/board/adapters.ts — адаптеры модулей OSINT.
// Каждый модуль = ToolDef. Подключайте свои эндпоинты правкой массива TOOLS ниже.

import type { Kind, Lead } from './model';
import { normalizeDomain } from '../lib/domain';

// Для доменных модулей: "https://WWW.Example.com/path" → "example.com"
const asDomain = (v: string) => normalizeDomain(v) ?? v.trim();

export interface ToolOutput {
  summary: string;
  raw: unknown;
  leads: Lead[];
}

export interface ToolDef {
  id: string;
  label: string;
  kinds: Kind[]; // для каких форматов модуль подходит
  run(value: string, signal?: AbortSignal): Promise<ToolOutput>;
}

// ---- Извлечение зацепок из произвольного ответа API ----

const BAD_TLD = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'html',
  'txt', 'md', 'pdf', 'map', 'ico', 'woff', 'woff2', 'xml', 'yml', 'yaml',
]);

export function extractLeads(raw: unknown, exclude: string[] = [], limit = 20): Lead[] {
  let text = typeof raw === 'string' ? raw : JSON.stringify(raw) ?? '';
  const skip = new Set(exclude.map((s) => s.trim().toLowerCase()));
  const out: Lead[] = [];
  const seen = new Set<string>();
  const push = (kind: Kind, value: string, label: string) => {
    const v = value.trim().replace(/[.,;)\]]+$/, '');
    const key = `${kind}:${v.toLowerCase()}`;
    if (!v || skip.has(v.toLowerCase()) || seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({ kind, value: v, label });
  };

  const emails = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  emails.forEach((m) => push('email', m, 'почта'));
  text = text.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ');

  const urls = text.match(/https?:\/\/[^\s"'<>\\]+/gi) ?? [];
  urls.forEach((m) => push('url', m, 'ссылка'));
  text = text.replace(/https?:\/\/[^\s"'<>\\]+/gi, ' ');

  const ips = text.match(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g) ?? [];
  ips.forEach((m) => push('ip', m, 'IP'));
  text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, ' ');

  const domains = text.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi) ?? [];
  domains.forEach((m) => {
    const tld = m.split('.').pop()!.toLowerCase();
    if (!BAD_TLD.has(tld)) push('domain', m, 'домен');
  });

  return out;
}

// ---- Фабрика для обычных /api/* маршрутов ----

interface ApiToolOpts {
  id: string;
  label: string;
  kinds: Kind[];
  endpoint: string;
  param: string; // имя параметра с проверяемым значением
  method?: 'GET' | 'POST'; // GET: ?param=value, POST: JSON { param: value }
  prepare?: (value: string) => string; // например, убрать "@" у ника
}

export function apiTool(o: ApiToolOpts): ToolDef {
  return {
    id: o.id,
    label: o.label,
    kinds: o.kinds,
    async run(value, signal) {
      const v = o.prepare ? o.prepare(value) : value;
      const res =
        o.method === 'POST'
          ? await fetch(o.endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [o.param]: v }),
              signal,
            })
          : await fetch(`${o.endpoint}?${o.param}=${encodeURIComponent(v)}`, { signal });

      if (res.status === 404) throw new Error(`Эндпоинт ${o.endpoint} не найден`);
      const ct = res.headers.get('content-type') ?? '';
      const raw: unknown = ct.includes('json') ? await res.json() : await res.text();
      if (!res.ok) {
        const msg =
          typeof raw === 'object' && raw && 'error' in raw ? String((raw as { error: unknown }).error) : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const leads = extractLeads(raw, [value, v]);
      const obj = raw as Record<string, unknown> | null;
      const summary =
        (obj && typeof obj === 'object' && (typeof obj.summary === 'string' ? obj.summary : typeof obj.message === 'string' ? obj.message : '')) ||
        `Ответ получен, найдено зацепок: ${leads.length}`;
      return { summary, raw, leads };
    },
  };
}

// ---- Реестр модулей: поправьте endpoint / param / method под ваши route.ts ----

export const TOOLS: ToolDef[] = [
  apiTool({ id: 'dns', label: 'DNS-записи', kinds: ['domain', 'url'], endpoint: '/api/dns', param: 'domain', prepare: asDomain }),
  apiTool({ id: 'rdap', label: 'Регистрация домена', kinds: ['domain', 'url'], endpoint: '/api/rdap', param: 'domain', prepare: asDomain }),
  apiTool({ id: 'subdomains', label: 'Поддомены', kinds: ['domain', 'url'], endpoint: '/api/subdomains', param: 'domain', prepare: asDomain }),
  apiTool({ id: 'site-check', label: 'Проверка сайта', kinds: ['url', 'domain'], endpoint: '/api/site-check', param: 'url' }),
  apiTool({ id: 'ip', label: 'IP-анализ', kinds: ['ip'], endpoint: '/api/ip', param: 'ip' }),
  apiTool({ id: 'phone', label: 'Проверка номера', kinds: ['phone'], endpoint: '/api/phone', param: 'number' }),
  apiTool({ id: 'check-email', label: 'Поиск по почте', kinds: ['email'], endpoint: '/api/check-email', param: 'email' }),
  apiTool({
    id: 'username',
    label: 'Поиск по нику',
    kinds: ['username'],
    endpoint: '/api/username', // TODO: укажите реальный маршрут поиска по нику
    param: 'username',
    prepare: (v) => v.replace(/^@/, ''),
  }),
];

export const toolsFor = (kind: Kind) => TOOLS.filter((t) => t.kinds.includes(kind));
export const getTool = (id: string | null) => TOOLS.find((t) => t.id === id);