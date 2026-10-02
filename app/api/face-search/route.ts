import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("photo") as File;

    if (!file) {
      return NextResponse.json({ error: "Файл не загружен" }, { status: 400 });
    }

    const serpApiKey = process.env.SERPAPI_KEY;
    const imgbbApiKey = process.env.IMGBB_API_KEY;

    if (!serpApiKey) {
      return NextResponse.json(
        { error: "На сервере не задан ключ SERPAPI_KEY." },
        { status: 500 }
      );
    }

    if (!imgbbApiKey) {
      return NextResponse.json(
        { error: "На сервере не задан ключ IMGBB_API_KEY." },
        { status: 500 }
      );
    }

    // 1. Загружаем фото на ImgBB, чтобы получить публичную ссылку для Google Lens
    const imgbbFormData = new FormData();
    imgbbFormData.append("image", file);

    const imgbbRes = await fetch(
      `https://api.imgbb.com/1/upload?key=${imgbbApiKey}`,
      {
        method: "POST",
        body: imgbbFormData,
      }
    );

    const imgbbData = await imgbbRes.json();

    if (!imgbbData.success || !imgbbData.data?.url) {
      return NextResponse.json(
        { error: "Ошибка при временной загрузке изображения." },
        { status: 500 }
      );
    }

    const imageUrl = imgbbData.data.url;

    // 2. Отправляем ссылку в SerpApi (Google Lens API)
    const serpUrl = `https://serpapi.com/search.json?engine=google_lens&url=${encodeURIComponent(
      imageUrl
    )}&api_key=${serpApiKey}`;

    const serpRes = await fetch(serpUrl);
    const serpData = await serpRes.json();

    if (serpData.error) {
      return NextResponse.json(
        { error: `SerpApi Error: ${serpData.error}` },
        { status: 500 }
      );
    }

    // 3. Форматируем найденные совпадения
    const matches = serpData.visual_matches || [];
    const formattedResults = matches.map((item: any) => ({
      name: item.title || item.source || "Ссылка",
      url: item.thumbnail || item.images?.[0]?.thumbnail,
      link: item.link,
      source: item.source,
    }));

    return NextResponse.json({ results: formattedResults });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Ошибка сервера" },
      { status: 500 }
    );
  }
}