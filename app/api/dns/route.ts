// app/api/dns/route.ts — DNS-записи через DNS-over-HTTPS (Cloudflare)
import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "../../lib/domain";

const TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CAA"] as const;

async function query(domain: string, type: string): Promise<string[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("doh " + res.status);
  const data = await res.json();
  return (data.Answer ?? [])
    .filter((a: any) => a.type === { A: 1, AAAA: 28, MX: 15, NS: 2, TXT: 16, CAA: 257 }[type])
    .map((a: any) => String(a.data).replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
}

export async function POST(request: NextRequest) {
  const { domain: raw } = (await request.json().catch(() => ({}))) as { domain?: string };
  const domain = normalizeDomain(raw ?? "", true);
  if (!domain) return NextResponse.json({ error: "invalid_domain", detail: "Введите домен, например example.com" }, { status: 400 });

  try {
    const results = await Promise.all(TYPES.map((t) => query(domain, t)));
    const records: Record<string, string[]> = {};
    TYPES.forEach((t, i) => (records[t] = results[i]));
    return NextResponse.json({ domain, records });
  } catch (e) {
    console.error("dns failed:", e);
    return NextResponse.json({ error: "dns_failed", detail: "DNS-сервис не ответил. Попробуйте ещё раз." }, { status: 502 });
  }
}