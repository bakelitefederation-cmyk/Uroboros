// app/api/face-search/route.ts
import { NextRequest, NextResponse } from 'next/server';

const ENDPOINT = 'https://search4faces.com/api/json-rpc/v1';

const SOURCES = ['vkok_avatar', 'vkokn_avatar', 'vk_wall', 'tt_avatar', 'ch_avatar', 'sb_photo'] as const;
type Source = (typeof SOURCES)[number];

const FACE_KEYS = [
  'x', 'y', 'width', 'height',
  'lm1_x', 'lm1_y', 'lm2_x', 'lm2_y', 'lm3_x', 'lm3_y', 'lm4_x', 'lm4_y', 'lm5_x', 'lm5_y',
] as const;
type Face = Record<(typeof FACE_KEYS)[number], number>;

const MAX_BASE64_LENGTH = 11 * 1024 * 1024;
const MAX_RESULTS = 500;

class RpcError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function rpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.SEARCH4FACES_API_KEY;
  if (!apiKey) throw new RpcError('config_error', 'Не задан SEARCH4FACES_API_KEY');

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authorization-token': apiKey },
      body: JSON.stringify({ jsonrpc: '2.0', method, id: crypto.randomUUID(), params }),
      cache: 'no-store',
    });
  } catch {
    throw new RpcError('network_error', 'search4faces.com недоступен');
  }

  const data = await res.json().catch(() => null);
  if (!data) throw new RpcError('bad_response', `Некорректный ответ (HTTP ${res.status})`);
  if (data.error) {
    throw new RpcError('api_error', data.error.message ?? JSON.stringify(data.error));
  }
  return data.result as T;
}

function parseFace(raw: unknown): Face | null {
  if (!raw || typeof raw !== 'object') return null;
  const face = {} as Face;
  for (const key of FACE_KEYS) {
    const value = Number((raw as Record<string, unknown>)[key]);
    if (!Number.isFinite(value)) return null;
    face[key] = Math.round(value);
  }
  return face;
}

type RawProfile = Record<string, unknown>;

function normalizeProfile(p: RawProfile, source: Source) {
  const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    score: Number(p.score) || 0,
    face: str(p.face),
    profile: str(p.profile),
    photo: str(p.photo),
    sourceImage: str(p.source),
    age: num(p.age),
    firstName: str(p.first_name),
    lastName: str(p.last_name),
    maidenName: str(p.maiden_name),
    city: str(p.city),
    country: str(p.country),
    database: source,
  };
}

async function getLimit() {
  try {
    const r = await rpc<{ limit: number; remaining: number; enddate: string; speed: number }>('rateLimit', {});
    return { limit: r.limit, remaining: r.remaining, enddate: r.enddate, speed: r.speed };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  try {
    if (body.action === 'limit') {
      return NextResponse.json({ limit: await getLimit() });
    }

    if (body.action === 'detect') {
      const image = typeof body.image === 'string' ? body.image : '';
      if (!image || image.length > MAX_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(image)) {
        return NextResponse.json({ error: 'invalid_image' }, { status: 400 });
      }
      const result = await rpc<{ image: string; faces: unknown[]; scale?: string | number }>('detectFaces', { image });
      const faces = (result.faces ?? []).map(parseFace).filter((f): f is Face => f !== null);
      return NextResponse.json({
        imageId: result.image,
        faces,
        scale: Number(result.scale) || 1,
      });
    }

    if (body.action === 'search') {
      const imageId = typeof body.imageId === 'string' ? body.imageId : '';
      const face = parseFace(body.face);
      if (!imageId || imageId.length > 200 || !face) {
        return NextResponse.json({ error: 'invalid_params' }, { status: 400 });
      }

      const requested: unknown[] = Array.isArray(body.sources) ? body.sources : [];
      const sources = SOURCES.filter((s) => requested.includes(s));
      if (sources.length === 0) {
        return NextResponse.json({ error: 'no_sources' }, { status: 400 });
      }

      const results = Math.min(Math.max(Math.round(Number(body.results) || 50), 1), MAX_RESULTS);
      const hidden = Boolean(body.hidden);

      const settled = await Promise.allSettled(
        sources.map((source) =>
          rpc<{ profiles?: RawProfile[] }>('searchFace', {
            image: imageId,
            face,
            source,
            hidden,
            results: String(results),
            lang: 'ru',
          }),
        ),
      );

      const bySource = sources.map((source, i) => {
        const r = settled[i];
        if (r.status === 'fulfilled') {
          return {
            source,
            ok: true as const,
            profiles: (r.value.profiles ?? []).map((p) => normalizeProfile(p, source)),
          };
        }
        return {
          source,
          ok: false as const,
          error: r.reason instanceof Error ? r.reason.message : 'unknown_error',
          profiles: [],
        };
      });

      return NextResponse.json({ bySource, limit: await getLimit() });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  } catch (err) {
    const code = err instanceof RpcError ? err.code : 'unknown_error';
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('face-search failed:', code, message);
    return NextResponse.json(
      { error: code, detail: message },
      { status: code === 'config_error' ? 500 : 502 },
    );
  }
}
