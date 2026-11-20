// app/board/adapters.ts — подключение модулей Uroboros к доске.
// Каждый модуль = ToolDef: берёт значение карточки, ходит в ваш /api/* маршрут и возвращает
// краткий итог (summary), сырой ответ (raw) и «зацепки» (leads) — новые данные, которые можно закрепить на доске.
// Все маршруты проекта принимают POST с JSON, поэтому здесь везде POST и имена полей как в route.ts.

import type { Kind, Lead } from './model';
import { normalizeDomain } from '../lib/domain';

export interface ToolOutput {
  summary: string;
  raw: unknown;
  leads: Lead[];
}

export interface ToolDef {
  id: string;
  label: string;
  kinds: Kind[]; // для каких форматов модуль подходит; [] — только в списке «Другие»
  hint?: string; // подсказка под выбором модуля
  auto?: boolean; // false — не входит в «Запустить все подходящие» (долгие или тяжёлые модули)
  run(value: string, signal?: AbortSignal): Promise<ToolOutput>;
}

// ---------- Мелкие помощники ----------

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const str = (x: unknown): string => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : '');
const strs = (x: unknown): string[] => arr(x).map(str).filter(Boolean);
const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

const asDomain = (v: string) => normalizeDomain(v) ?? v.trim();
const asUrl = (v: string) => (/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${asDomain(v)}`);
const day = (iso: unknown) => str(iso).slice(0, 10);
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

const LEAD_LIMIT = 20;
const lead = (kind: Kind, value: string, label: string): Lead => ({ kind, value: value.trim(), label });

/** Убирает дубли, пустые значения и то, что уже было в запросе; режет до limit. */
function clean(leads: Lead[], exclude: string[] = [], limit = LEAD_LIMIT): Lead[] {
  const skip = new Set(exclude.map((s) => s.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const l of leads) {
    const v = l.value.replace(/[.,;)\]]+$/, '');
    const key = `${l.kind}:${v.toLowerCase()}`;
    if (!v || skip.has(v.toLowerCase()) || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...l, value: v });
    if (out.length >= limit) break;
  }
  return out;
}

// ---------- Запросы к API ----------

const ERRORS: Record<string, string> = {
  invalid_domain: 'Некорректный домен',
  invalid_url: 'Некорректная ссылка',
  invalid_username: 'Ник слишком короткий (нужно от 2 символов)',
  invalid_format: 'Неверный формат значения',
  invalid_messages: 'Пустой запрос',
  not_found: 'Ничего не найдено',
  blocked: 'Адрес недоступен для проверки',
  unreachable: 'Сайт не ответил',
  rdap_failed: 'Реестр не ответил',
  dns_failed: 'DNS-сервис не ответил',
  network_error: 'Сервер не смог достучаться до сервиса',
  data_load_failed: 'Не удалось загрузить базу сайтов',
  sources_unavailable: 'Источники сейчас недоступны',
  model_error: 'ИИ-модель не ответила',
  agent_error: 'Внутренняя ошибка агента',
  config_error: 'Не заданы ключи в переменных окружения',
};

async function post(endpoint: string, body: unknown, signal?: AbortSignal): Promise<Obj> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Нет связи с сервером');
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  const data = isJson ? obj(await res.json().catch(() => ({}))) : {};
  if (res.status === 404 && !isJson) throw new Error(`Маршрут ${endpoint} не найден`);
  if (!res.ok) {
    const msg = str(data.detail) || ERRORS[str(data.error)] || str(data.error);
    if (msg) throw new Error(msg);
    if (res.status === 504 || res.status === 408) throw new Error('Сервер не успел ответить (лимит времени функции на хостинге)');
    throw new Error(`Ошибка сервера: HTTP ${res.status}`);
  }
  return data;
}

/** Запуск модуля с общим таймаутом; внешняя отмена тоже работает. */
export async function runTool(tool: ToolDef, value: string, signal?: AbortSignal, ms = 55_000): Promise<ToolOutput> {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  if (signal?.aborted) ac.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await tool.run(value, ac.signal);
  } catch (e) {
    if ((e as Error).name === 'AbortError' && !signal?.aborted) throw new Error(`Модуль не ответил за ${Math.round(ms / 1000)} с`);
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// ---------- Извлечение данных из текста (для заметок и ответа ИИ-агента) ----------

const BAD_TLD = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'html',
  'txt', 'md', 'pdf', 'map', 'ico', 'woff', 'woff2', 'xml', 'yml', 'yaml', 'webp', 'avif', 'zip', 'exe',
]);
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const URL_RE = /https?:\/\/[^\s"'<>\\)]+/gi;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const PHONE_RE = /(?<![\w+])(?:\+\d[\d\s().-]{8,16}\d|0\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2})(?!\d)/g;
const HANDLE_RE = /(?<![\w@.])@([a-z0-9_]{3,32})\b/gi;

/** Достаёт из произвольного текста почты, ссылки, IP, домены, телефоны и @ники. */
export function extractLeads(raw: unknown, exclude: string[] = [], limit = 40): Lead[] {
  let text = typeof raw === 'string' ? raw : (JSON.stringify(raw) ?? '');
  const found: Lead[] = [];

  (text.match(EMAIL_RE) ?? []).forEach((m) => found.push(lead('email', m, 'почта')));
  text = text.replace(EMAIL_RE, ' ');
  (text.match(URL_RE) ?? []).forEach((m) => found.push(lead('url', m, 'ссылка')));
  text = text.replace(URL_RE, ' ');
  (text.match(IPV4_RE) ?? []).forEach((m) => found.push(lead('ip', m, 'IP')));
  text = text.replace(IPV4_RE, ' ');
  (text.match(PHONE_RE) ?? []).forEach((m) => {
    if ((m.match(/\d/g)?.length ?? 0) >= 10) found.push(lead('phone', m.replace(/\s+/g, ' '), 'телефон'));
  });
  text = text.replace(PHONE_RE, ' ');
  (text.match(DOMAIN_RE) ?? []).forEach((m) => {
    if (!BAD_TLD.has(m.split('.').pop()!.toLowerCase())) found.push(lead('domain', m.toLowerCase(), 'домен'));
  });
  for (const m of text.matchAll(HANDLE_RE)) found.push(lead('username', m[1], 'ник'));

  return clean(found, exclude, limit);
}

// ---------- Модули ----------

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com',
  'proton.me', 'protonmail.com', 'mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'yandex.ru', 'yandex.com', 'ya.ru',
  'ukr.net', 'i.ua', 'meta.ua', 'rambler.ru', 'gmx.com', 'aol.com', 'tutanota.com',
]);
const GENERIC_LOCAL = new Set([
  'info', 'admin', 'support', 'contact', 'office', 'mail', 'sales', 'hello', 'noreply', 'no-reply',
  'postmaster', 'webmaster', 'abuse', 'root', 'test', 'service', 'team',
]);

const dnsTool: ToolDef = {
  id: 'dns',
  label: 'DNS-записи',
  kinds: ['domain', 'url'],
  async run(value, signal) {
    const domain = asDomain(value);
    const raw = await post('/api/dns', { domain }, signal);
    const rec = obj(raw.records);
    const A = strs(rec.A);
    const AAAA = strs(rec.AAAA);
    const MX = strs(rec.MX);
    const NS = strs(rec.NS);
    const TXT = strs(rec.TXT);
    const leads: Lead[] = [];
    A.forEach((ip) => leads.push(lead('ip', ip, 'A-запись')));
    AAAA.forEach((ip) => leads.push(lead('ip', ip, 'AAAA-запись')));
    MX.forEach((m) => leads.push(lead('domain', (m.split(/\s+/).pop() ?? '').replace(/\.$/, ''), 'почтовый сервер')));
    NS.forEach((n) => leads.push(lead('domain', n.replace(/\.$/, ''), 'NS')));
    for (const t of TXT.filter((x) => /^v=spf1/i.test(x))) {
      for (const tok of t.split(/\s+/)) {
        const inc = tok.match(/^(?:\+|~|-|\?)?(?:include:|redirect=)(.+)$/i);
        if (inc) leads.push(lead('domain', inc[1], 'SPF'));
        const ip4 = tok.match(/^(?:\+|~|-|\?)?ip4:((?:\d{1,3}\.){3}\d{1,3})(?:\/32)?$/i);
        if (ip4) leads.push(lead('ip', ip4[1], 'SPF'));
      }
    }
    const summary = `${domain}: A ${A.length}, AAAA ${AAAA.length}, MX ${MX.length}, NS ${NS.length}, TXT ${TXT.length}`;
    return { summary, raw, leads: clean(leads, [value, domain]) };
  },
};

const rdapTool: ToolDef = {
  id: 'rdap',
  label: 'Регистрация домена',
  kinds: ['domain', 'url'],
  async run(value, signal) {
    const domain = asDomain(value);
    const raw = await post('/api/rdap', { domain }, signal);
    const created = str(raw.registered);
    const ageDays = created ? Math.floor((Date.now() - Date.parse(created)) / 86_400_000) : NaN;
    const parts = [
      `Регистратор: ${str(raw.registrar) || 'не указан'}`,
      created ? `создан ${day(created)}${Number.isFinite(ageDays) ? ` (${ageDays} дн. назад${ageDays < 90 ? ', домен совсем новый' : ''})` : ''}` : 'дата создания неизвестна',
      str(raw.expires) ? `истекает ${day(raw.expires)}` : '',
    ].filter(Boolean);
    const leads = strs(raw.nameservers).map((n) => lead('domain', n, 'NS'));
    return { summary: parts.join('; '), raw, leads: clean(leads, [value, domain]) };
  },
};

const subdomainsTool: ToolDef = {
  id: 'subdomains',
  label: 'Поддомены',
  kinds: ['domain', 'url'],
  hint: 'Журналы сертификатов crt.sh: бывают медленными, иногда нужна вторая попытка.',
  async run(value, signal) {
    const domain = asDomain(value);
    const raw = await post('/api/subdomains', { domain }, signal);
    const list = strs(raw.subdomains).filter((s) => s !== domain && !s.startsWith('*') && !/^www\./.test(s));
    const total = num(raw.count) || list.length;
    const more = list.length > LEAD_LIMIT ? ` На доску предложены первые ${LEAD_LIMIT}, остальные в сыром ответе.` : '';
    return {
      summary: `Найдено ${total} ${plural(total, 'поддомен', 'поддомена', 'поддоменов')}.${more}`,
      raw,
      leads: clean(list.map((s) => lead('domain', s, 'поддомен')), [value, domain]),
    };
  },
};

const siteTool: ToolDef = {
  id: 'site-check',
  label: 'Проверка сайта',
  kinds: ['url', 'domain'],
  async run(value, signal) {
    const domain = asDomain(value);
    const raw = await post('/api/site-check', { domain }, signal);
    const chain = arr(raw.chain).map(obj);
    const last = chain[chain.length - 1];
    const sec = obj(raw.security);
    const secOn = Object.values(sec).filter(Boolean).length;
    const info = obj(raw.info);
    const server = str(info.server) || str(info['x-powered-by']);
    const redirects = Math.max(0, chain.length - 1);
    const summary = [
      `Ответ ${last ? num(last.status) : '?'}`,
      redirects ? `редиректов: ${redirects}` : 'без редиректов',
      server ? `сервер: ${server}` : '',
      `заголовков защиты: ${secOn} из ${Object.keys(sec).length}`,
    ]
      .filter(Boolean)
      .join('; ');
    const leads: Lead[] = [];
    const finalUrl = str(raw.finalUrl);
    if (finalUrl && normalizeDomain(finalUrl) !== domain) leads.push(lead('url', finalUrl, 'финальный адрес'));
    for (const hop of chain) {
      const host = normalizeDomain(str(hop.url));
      if (host && host !== domain) leads.push(lead('domain', host, 'редирект'));
    }
    return { summary, raw, leads: clean(leads, [value, domain]) };
  },
};

const waybackTool: ToolDef = {
  id: 'wayback',
  label: 'Веб-архив (Wayback)',
  kinds: ['url', 'domain'],
  async run(value, signal) {
    const url = asUrl(value);
    const raw = await post('/api/wayback', { url }, signal);
    const latest = obj(raw.latestSnapshot);
    const history = arr(raw.history).map(obj);
    if (!raw.hasSnapshots) return { summary: 'Снимков в архиве нет.', raw, leads: [] };
    const first = history[0];
    const leads: Lead[] = [];
    if (first && str(first.archiveUrl)) leads.push(lead('url', str(first.archiveUrl), `самый ранний снимок ${str(first.date)}`));
    if (str(latest.archiveUrl) && str(latest.archiveUrl) !== str(first?.archiveUrl)) {
      leads.push(lead('url', str(latest.archiveUrl), `свежий снимок ${str(latest.date)}`));
    }
    const n = history.length;
    return {
      summary: `Снимков в истории: ${n}${n >= 30 ? '+' : ''}${first ? `; первый ${str(first.date)}` : ''}${str(latest.date) ? `; ближайший ${str(latest.date)}` : ''}`,
      raw,
      leads: clean(leads, [value]),
    };
  },
};

const virusTotalTool: ToolDef = {
  id: 'virustotal',
  label: 'VirusTotal',
  kinds: ['url', 'domain'],
  hint: 'Бесплатный ключ VirusTotal даёт около 4 проверок в минуту.',
  async run(value, signal) {
    const url = asUrl(value);
    const raw = await post('/api/virustotal', { url }, signal);
    const s = obj(raw.stats);
    const bad = num(s.malicious);
    const sus = num(s.suspicious);
    const summary = `${bad ? '⚠ ' : ''}Вредоносных: ${bad}, подозрительных: ${sus}, чистых: ${num(s.harmless)}, не определено: ${num(s.undetected)}${raw.cached ? ' (из кэша VirusTotal)' : ''}`;
    return { summary, raw, leads: [] };
  },
};

const ipTool: ToolDef = {
  id: 'ip',
  label: 'IP-анализ',
  kinds: ['ip'],
  async run(value, signal) {
    const raw = await post('/api/ip', { ip: value.trim() }, signal);
    if (str(raw.status) === 'fail') throw new Error(`Сервис геолокации: ${str(raw.message) || 'адрес не найден'}`);
    const where = [str(raw.country), str(raw.city)].filter(Boolean).join(', ');
    const summary = [where, str(raw.isp) && `провайдер ${str(raw.isp)}`, str(raw.org) && `организация ${str(raw.org)}`]
      .filter(Boolean)
      .join('; ');
    return { summary: summary || 'Данных об адресе нет', raw, leads: [] };
  },
};

const phoneTool: ToolDef = {
  id: 'phone',
  label: 'Проверка номера',
  kinds: ['phone'],
  hint: 'Ищет упоминания номера в Google через Serper. Владельца номер не раскрывает.',
  async run(value, signal) {
    const raw = await post('/api/phone', { phone: value.trim() }, signal);
    const results = arr(raw.results).map(obj);
    const leads = results.map((r) => lead('url', str(r.url), str(r.title).slice(0, 40) || 'упоминание номера')).filter((l) => l.value);
    return {
      summary: results.length
        ? `Найдено упоминаний: ${results.length}. Это гипотезы: совпадение номера на странице не доказывает связь.`
        : 'Упоминаний номера в поиске не найдено.',
      raw,
      leads: clean(leads, [], 10),
    };
  },
};

const emailTool: ToolDef = {
  id: 'check-email',
  label: 'Проверка почты',
  kinds: ['email'],
  async run(value, signal) {
    const email = value.trim();
    const raw = await post('/api/check-email', { email }, signal);
    const g = obj(raw.gravatar);
    const [local, domain = ''] = email.toLowerCase().split('@');
    const summary = [
      raw.domainAcceptsMail ? 'домен принимает почту' : 'у домена нет почтовых записей',
      raw.disposable ? 'одноразовый адрес' : '',
      g.exists ? `Gravatar: ${str(g.displayName) || 'есть аватар'}` : 'Gravatar: нет',
    ]
      .filter(Boolean)
      .join('; ');
    const leads: Lead[] = [];
    if (domain && !FREE_MAIL.has(domain)) leads.push(lead('domain', domain, 'домен почты'));
    if (local && local.length >= 3 && !GENERIC_LOCAL.has(local) && /^[\w.-]+$/.test(local)) leads.push(lead('username', local, 'возможный ник'));
    if (str(g.profileUrl)) leads.push(lead('url', str(g.profileUrl), 'профиль Gravatar'));
    return { summary: `${raw.validFormat ? 'Формат верный' : 'Формат неверный'}; ${summary}`, raw, leads: clean(leads, [email]) };
  },
};

const usernameTool: ToolDef = {
  id: 'username',
  label: 'Поиск по нику (Sherlock)',
  kinds: ['username'],
  hint: 'Проверяет около 400 сайтов, это может занять до минуты. Совпадение ника не доказывает, что это один человек.',
  async run(value, signal) {
    const raw = await post('/api/username', { username: value.trim().replace(/^@/, '') }, signal);
    const results = arr(raw.results).map(obj);
    const leads = results.map((r) => lead('url', str(r.url), `профиль ${str(r.site)}`)).filter((l) => l.value);
    return {
      summary: `Найдено профилей: ${num(raw.foundCount) || results.length} из ${num(raw.totalChecked)} сайтов. Это гипотезы: совпадение ника не доказывает, что аккаунты принадлежат одному человеку.`,
      raw,
      leads: clean(leads, [], 30),
    };
  },
};

const aircraftTool: ToolDef = {
  id: 'aircraft',
  label: 'Самолёт по позывному',
  kinds: [],
  hint: 'Только для бортов, которые сейчас в воздухе.',
  async run(value, signal) {
    const raw = await post('/api/aircraft', { callsign: value.trim() }, signal);
    const list = arr(raw.aircraft).map(obj);
    if (!list.length) return { summary: 'Борт с таким позывным сейчас не в воздухе.', raw, leads: [] };
    const lines = list.slice(0, 3).map((a) => {
      const alt = num(a.altitude);
      return `${str(a.callsign) || str(a.icao24)} (${str(a.originCountry) || '—'}${alt ? `, ${alt} м` : ''}${a.onGround ? ', на земле' : ''})`;
    });
    return { summary: `Найдено бортов: ${list.length}. ${lines.join('; ')}`, raw, leads: [] };
  },
};

const agentTool: ToolDef = {
  id: 'agent',
  label: 'ИИ-агент (исследует сам)',
  kinds: [],
  auto: false,
  hint: 'Агент сам выбирает модули Uroboros. Может работать до минуты и тратит лимит языковой модели.',
  async run(value, signal) {
    const raw = await post('/api/agent', { messages: [{ role: 'user', content: `Исследуй: ${value.trim()}` }] }, signal);
    const reply = str(raw.reply);
    const summary = reply.length > 1400 ? `${reply.slice(0, 1400)}…` : reply || 'Агент не вернул ответ';
    return { summary, raw, leads: extractLeads(reply, [value], 20) };
  },
};

const extractTool: ToolDef = {
  id: 'extract',
  label: 'Достать данные из текста',
  kinds: ['note'],
  hint: 'Работает без сети: находит в заметке почты, ссылки, IP, домены, телефоны и @ники.',
  async run(value) {
    const leads = extractLeads(value, [value]);
    return {
      summary: leads.length ? `Найдено объектов: ${leads.length}` : 'В тексте не нашлось ни почт, ни ссылок, ни IP, ни доменов.',
      raw: { text: value, found: leads },
      leads,
    };
  },
};

export const TOOLS: ToolDef[] = [
  dnsTool,
  rdapTool,
  subdomainsTool,
  siteTool,
  waybackTool,
  virusTotalTool,
  ipTool,
  phoneTool,
  emailTool,
  usernameTool,
  extractTool,
  aircraftTool,
  agentTool,
];

export const toolsFor = (kind: Kind) => TOOLS.filter((t) => t.kinds.includes(kind));
export const autoToolsFor = (kind: Kind) => toolsFor(kind).filter((t) => t.auto !== false);
export const getTool = (id: string | null) => TOOLS.find((t) => t.id === id);