// app/api/site-check/route.ts — как отвечает сайт: цепочка редиректов, заголовки, защитные заголовки
import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "../../lib/domain";
import { isPublicHost } from "../../lib/ssrf";

const SECURITY = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];
const INFO = ["server", "x-powered-by", "via", "content-type", "cache-control", "last-modified"];

export async function POST(request: NextRequest) {
  const { domain: raw } = (await request.json().catch(() => ({}))) as { domain?: string };
  const domain = normalizeDomain(raw ?? "", true);
  if (!domain) return NextResponse.json({ error: "invalid_domain", detail: "Введите домен, например example.com" }, { status: 400 });

  let url = `https://${domain}/`;
  const chain: { url: string; status: number }[] = [];
  let headers: Headers | null = null;

  try {
    for (let hop = 0; hop < 6; hop++) {
      const host = new URL(url).hostname;
      if (!(await isPublicHost(host))) {
        return NextResponse.json({ error: "blocked", detail: "Адрес не найден или указывает на внутреннюю сеть." }, { status: 400 });
      }
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Uroboros-OSINT/1.0" },
        cache: "no-store",
      });
      res.body?.cancel().catch(() => {});
      chain.push({ url, status: res.status });
      headers = res.headers;
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = new URL(loc, url);
        if (next.protocol !== "http:" && next.protocol !== "https:") break;
        url = next.toString();
        continue;
      }
      break;
    }
  } catch (e) {
    console.error("site-check failed:", e);
    return NextResponse.json({ error: "unreachable", detail: "Сайт не ответил за 6 секунд или недоступен по HTTPS." }, { status: 502 });
  }

  const h = headers!;
  return NextResponse.json({
    domain,
    finalUrl: chain[chain.length - 1].url,
    chain,
    info: Object.fromEntries(INFO.filter((k) => h.get(k)).map((k) => [k, h.get(k)])),
    security: Object.fromEntries(SECURITY.map((k) => [k, !!h.get(k)])),
  });
}