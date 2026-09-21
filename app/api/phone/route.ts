import { NextRequest, NextResponse } from "next/server";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export async function POST(request: NextRequest) {
  const { phone } = await request.json();

  const parsed = parsePhoneNumberFromString(phone);

  if (!parsed || !parsed.isValid()) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    country: parsed.country,
    type: parsed.getType() ?? "неизвестно",
    international: parsed.formatInternational(),
  });
}