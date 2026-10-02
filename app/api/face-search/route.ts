import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const photo = formData.get("photo") as File | null;
    const collections = formData.get("collections")
      ? JSON.parse(formData.get("collections") as string)
      : [];
    const limit = formData.get("limit") || "100";

    if (!photo) {
      return NextResponse.json(
        { error: "Файл изображения не передан" },
        { status: 400 }
      );
    }

    const luxandData = new FormData();
    luxandData.append("photo", photo);
    luxandData.append("collections", JSON.stringify(collections));
    luxandData.append("limit", limit.toString());

    const response = await fetch("https://api.luxand.cloud/photo/search", {
      method: "POST",
      headers: {
        token: process.env.LUXAND_API_TOKEN || "",
      },
      body: luxandData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Ошибка API Luxand: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, results: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}