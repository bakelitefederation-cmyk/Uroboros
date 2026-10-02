import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiToken = process.env.LUXAND_API_KEY;

    if (!apiToken) {
      return NextResponse.json(
        { error: "На сервере не задан ключ LUXAND_API_TOKEN." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const photo = formData.get("photo") as File | null;

    if (!photo) {
      return NextResponse.json(
        { error: "Файл изображения не был передан." },
        { status: 400 }
      );
    }

    const luxandFormData = new FormData();
    luxandFormData.append("photo", photo);

    const response = await fetch("https://api.luxand.cloud/photo/search", {
      method: "POST",
      headers: {
        token: apiToken,
      },
      body: luxandFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Ошибка при обращении к API Luxand." },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, results: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Внутренняя ошибка сервера." },
      { status: 500 }
    );
  }
}