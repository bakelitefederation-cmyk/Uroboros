import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const photo = formData.get("photo") as File | null;

    if (!photo) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    // Формируем payload для Luxand API
    const luxandFormData = new FormData();
    luxandFormData.append("photo", photo);

    // Запрос к Luxand
    const response = await fetch("https://api.luxand.cloud/photo/search", {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_TOKEN || "", // Важно: заголовок именно 'token'
      },
      body: luxandFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Ошибка API Luxand" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}