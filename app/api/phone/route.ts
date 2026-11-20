import { NextRequest, NextResponse } from "next/server";

// Поиск упоминаний номера через Serper (Google). Ключ: SERPER_API_KEY.
export async function POST(request: NextRequest) {
  const { phone } = await request.json().catch(() => ({ phone: "" }));
  const key = process.env.SERPER_API_KEY;
  const value = typeof phone === "string" ? phone.trim() : "";

  if (!value) return NextResponse.json({ error: true, detail: "Введите номер." }, { status: 400 });
  if (!key) return NextResponse.json({ error: true, detail: "На сервере не задан SERPER_API_KEY." }, { status: 500 });

  const digits = value.replace(/\D/g, "");
  const q = `"${value}" OR "${digits}"`;

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q, num: 10 }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return NextResponse.json({ error: true, detail: data?.message ?? "Serper вернул ошибку." }, { status: 502 });
    }
    const results = (Array.isArray(data.organic) ? data.organic : []).map(
      (r: { title?: string; link?: string; snippet?: string }) => ({
        title: r.title ?? "",
        url: r.link ?? "",
        snippet: r.snippet ?? "",
      })
    );
    return NextResponse.json({
      valid: digits.length >= 7 && digits.length <= 15,
      number: value,
      count: results.length,
      results,
    });
  } catch {
    return NextResponse.json({ error: true, detail: "Не удалось связаться с Serper." }, { status: 502 });
  }
}