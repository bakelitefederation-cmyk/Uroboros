// app/api/reverse-image/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface UploadResult {
  imageUrl: string;
  searchLinks: {
    google: string;
    yandex: string;
    tineye: string;
    bing: string;
  };
}

async function uploadToImgbb(file: File): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    throw new Error('config_error: не задан IMGBB_API_KEY в .env.local');
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');

  const formData = new FormData();
  formData.append('image', base64);

  let res: Response;
  try {
    res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });
  } catch (networkErr) {
    console.error('imgbb network error:', networkErr);
    throw new Error('network_error: imgbb.com недоступен');
  }

  const data = await res.json();

  if (!res.ok || !data?.data?.url) {
    console.error('imgbb error response:', data);
    throw new Error(`imgbb_error: ${JSON.stringify(data)}`);
  }

  return data.data.url as string;
}

function buildSearchLinks(imageUrl: string) {
  const encoded = encodeURIComponent(imageUrl);
  return {
    google: `https://lens.google.com/uploadbyurl?url=${encoded}`,
    yandex: `https://yandex.com/images/search?rpt=imageview&url=${encoded}`,
    tineye: `https://tineye.com/search?url=${encoded}`,
    bing: `https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIVSP&sbisrc=UrlPaste&q=imgurl:${encoded}`,
  };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('image');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'no_image' }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }

  try {
    const imageUrl = await uploadToImgbb(file);
    const searchLinks = buildSearchLinks(imageUrl);

    const result: UploadResult = { imageUrl, searchLinks };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('reverse-image upload failed:', message);
    return NextResponse.json({ error: 'upload_failed', detail: message }, { status: 500 });
  }
}