// app/api/check-email/route.ts
import dns from 'dns/promises';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Небольшой стартовый список одноразовых доменов.
// Для продакшена лучше подключить полный список, например:
// https://github.com/disposable-email-domains/disposable-email-domains (JSON, бесплатно, MIT-лицензия)
const DISPOSABLE_DOMAINS = new Set<string>([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'throwawaymail.com',
]);

interface GravatarResult {
  exists: boolean;
  displayName?: string | null;
  profileUrl?: string | null;
}

function isValidFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function checkMx(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

async function checkGravatar(email: string): Promise<GravatarResult> {
  const hash = crypto
    .createHash('md5')
    .update(email.trim().toLowerCase())
    .digest('hex');

  // d=404 — чтобы Gravatar вернул 404 вместо дефолтной картинки, если профиля нет
  const res = await fetch(`https://www.gravatar.com/avatar/${hash}?d=404`);
  if (res.status !== 200) return { exists: false };

  // Полный публичный профиль (если пользователь сделал его открытым)
  try {
    const profileRes = await fetch(`https://www.gravatar.com/${hash}.json`);
    if (profileRes.ok) {
      const data = await profileRes.json();
      const entry = data.entry?.[0];
      return {
        exists: true,
        displayName: entry?.displayName ?? null,
        profileUrl: entry?.profileUrl ?? null,
      };
    }
  } catch {
    // профиль есть, но не публичный — просто подтверждаем наличие аватара
  }

  return { exists: true, displayName: null, profileUrl: null };
}

export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email?: string };

  if (!email || !isValidFormat(email)) {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }

  const domain = email.split('@')[1].toLowerCase();

  const [mxValid, gravatar] = await Promise.all([
    checkMx(domain),
    checkGravatar(email),
  ]);

  return NextResponse.json({
    email,
    validFormat: true,
    domainAcceptsMail: mxValid,
    disposable: DISPOSABLE_DOMAINS.has(domain),
    gravatar,
  });
}