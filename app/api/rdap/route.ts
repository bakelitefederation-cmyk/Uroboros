// app/api/rdap/route.ts — регистрационные данные домена (RDAP, публичный протокол вместо WHOIS)
import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "../../lib/domain";

export async function POST(request: NextRequest) {
  const { domain: raw } = (await request.json().catch(() => ({}))) as { domain?: string };
  const domain = normalizeDomain(raw ?? "");
  if (!domain) return NextResponse.json({ error: "invalid_domain", detail: "Введите домен, например example.com" }, { status: 400 });

  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/rdap+json, application/json", "User-Agent": "Uroboros-OSINT/1.0" },
      cache: "no-store",
    });
    if (res.status === 404) {
      return NextResponse.json({ error: "not_found", detail: "Домен не найден в реестре. Возможно, он не зарегистрирован или зона не поддерживает RDAP." }, { status: 404 });
    }
    if (!res.ok) throw new Error("rdap " + res.status);
    const d = await res.json();

    const events: Record<string, string> = {};
    for (const e of d.events ?? []) events[e.eventAction] = e.eventDate;

    // Берём только регистратора (компанию). Контакты владельца не выводим.
    let registrar: string | null = null;
    for (const ent of d.entities ?? []) {
      if ((ent.roles ?? []).includes("registrar")) {
        const fn = (ent.vcardArray?.[1] ?? []).find((x: any[]) => x[0] === "fn");
        registrar = fn?.[3] ?? null;
      }
    }

    return NextResponse.json({
      domain: d.ldhName ?? domain,
      registrar,
      status: d.status ?? [],
      registered: events["registration"] ?? null,
      updated: events["last changed"] ?? null,
      expires: events["expiration"] ?? null,
      nameservers: (d.nameservers ?? []).map((n: any) => String(n.ldhName).toLowerCase()),
      dnssec: d.secureDNS?.delegationSigned ?? null,
    });
  } catch (e) {
    console.error("rdap failed:", e);
    return NextResponse.json({ error: "rdap_failed", detail: "Реестр не ответил. Попробуйте через минуту." }, { status: 502 });
  }
}
