import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { phone } = await request.json();
  const key = process.env.ABSTRACT_PHONE_KEY;

  const res = await fetch(
    `https://phoneintelligence.abstractapi.com/v1/?api_key=${key}&phone=${encodeURIComponent(phone)}`
  );
  const data = await res.json();

  return NextResponse.json({
    valid: data.phone_validation?.is_valid ?? false,
    country: data.phone_location?.country_name,
    region: data.phone_location?.region,
    city: data.phone_location?.city,
    carrier: data.phone_carrier?.name,
    type: data.phone_carrier?.line_type,
    international: data.phone_format?.international,
  });
}