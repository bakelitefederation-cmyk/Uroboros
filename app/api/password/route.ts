import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const sha1 = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const text = await res.text();

  const match = text.split("\n").find((line) => line.startsWith(suffix));
  const count = match ? parseInt(match.split(":")[1]) : 0;

  return NextResponse.json({ found: count > 0, count });
}