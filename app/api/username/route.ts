import { NextRequest, NextResponse } from "next/server";

const SITES = [
  { name: "GitHub", url: (u: string) => `https://github.com/${u}` },
  { name: "Reddit", url: (u: string) => `https://www.reddit.com/user/${u}` },
  { name: "X (Twitter)", url: (u: string) => `https://x.com/${u}` },
  { name: "Instagram", url: (u: string) => `https://www.instagram.com/${u}` },
  { name: "GitLab", url: (u: string) => `https://gitlab.com/${u}` },
  { name: "Telegram", url: (u: string) => `https://t.me/${u}` },
];

export async function POST(request: NextRequest) {
  const { username } = await request.json();

  const checks = SITES.map(async (site) => {
    const url = site.url(username);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const found = res.status === 200;
      return { name: site.name, url, found };
    } catch {
      return { name: site.name, url, found: false };
    }
  });

  const results = await Promise.all(checks);
  return NextResponse.json({ results });
}