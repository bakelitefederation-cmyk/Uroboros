// app/api/subdomains/route.ts — поддомены из журналов сертификатов (Certificate Transparency, crt.sh)
import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "../../lib/domain";

export async function POST(request: NextRequest) {
  const { domain: raw } = (await request.json().catch(() => ({}))) as { domain?: string };
  const domain = normalizeDomain(raw ?? "");
  if (!domain) return NextResponse.json({ error: "invalid_domain", detail: "Введите домен, например example.com" }, { status: 400 });

  try {
    const res = await fetch(`https://crt.sh/?q=${encodeURIComponent("%." + domain)}&output=json`, {
      signal: AbortSignal.timeout(9000),
      headers: { "User-Agent": "Uroboros-OSINT/1.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("crt " + res.status);
    const rows = (await res.json()) as { name_value: string }[];

    const set = new Set<string>();
    for (const r of rows) {
      for (const n of String(r.name_value).split("\n")) {
        const name = n.trim().toLowerCase().replace(/^\*\./, "");
        if (name === domain || name.endsWith("." + domain)) set.add(name);
      }
    }
    const all = Array.from(set).sort();
    return NextResponse.json({ domain, count: all.length, subdomains: all.slice(0, 300), truncated: all.length > 300 });
  } catch (e) {
    console.error("crt.sh failed:", e);
    return NextResponse.json(
      { error: "crt_failed", detail: "Журнал сертификатов не ответил вовремя. У крупных доменов так бывает: попробуйте позже или другой домен." },
      { status: 504 },
    );
  }
}
