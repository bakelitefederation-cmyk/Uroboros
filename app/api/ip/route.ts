import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { ip } = await request.json();
  const target = ip?.trim() || "";

  const res = await fetch(`http://ip-api.com/json/${target}?fields=status,country,city,isp,org,query`);
  const data = await res.json();

  return NextResponse.json(data);
}