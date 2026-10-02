// app/api/exif/route.ts
import { NextRequest, NextResponse } from 'next/server';
import exifr from 'exifr';

interface ExifReport {
  fileInfo: {
    name: string;
    sizeBytes: number;
    type: string;
    width: number | null;
    height: number | null;
  };
  camera: Record<string, any>;
  dates: Record<string, any>;
  gps: {
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
    direction: number | null;
    timestamp: string | null;
    mapsUrl: string | null;
  };
  software: Record<string, any>;
  iptc: Record<string, any>;
  xmp: Record<string, any>;
  raw: Record<string, any>;
}

function pick(obj: Record<string, any> | null | undefined, keys: string[]) {
  if (!obj) return {};
  const result: Record<string, any> = {};
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) result[k] = obj[k];
  }
  return result;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('image');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'no_image' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let full: Record<string, any> = {};
  let gpsData: any = null;

  try {
    // Полный разбор всех блоков: EXIF, GPS, IFD0, Interop, IPTC, XMP, ICC
    full =
      (await exifr.parse(buffer, {
        tiff: true,
        exif: true,
        gps: true,
        iptc: true,
        xmp: true,
        icc: true,
        interop: true,
        ifd1: true,
        translateKeys: true,
        translateValues: true,
        reviveValues: true,
        sanitize: true,
        mergeOutput: true,
      })) ?? {};
  } catch (err) {
    console.error('exifr parse error:', err);
  }

  try {
    gpsData = await exifr.gps(buffer);
  } catch {
    gpsData = null;
  }

  const report: ExifReport = {
    fileInfo: {
      name: file.name,
      sizeBytes: file.size,
      type: file.type,
      width: full.ExifImageWidth ?? full.ImageWidth ?? null,
      height: full.ExifImageHeight ?? full.ImageHeight ?? null,
    },
    camera: pick(full, [
      'Make',
      'Model',
      'LensModel',
      'FNumber',
      'ExposureTime',
      'ISO',
      'FocalLength',
      'FocalLengthIn35mmFormat',
      'Flash',
      'Orientation',
      'WhiteBalance',
      'MeteringMode',
      'ExposureProgram',
      'ExposureCompensation',
    ]),
    dates: pick(full, ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'DateTimeDigitized']),
    gps: {
      latitude: gpsData?.latitude ?? null,
      longitude: gpsData?.longitude ?? null,
      altitude: full.GPSAltitude ?? null,
      direction: full.GPSImgDirection ?? null,
      timestamp: full.GPSDateStamp ?? null,
      mapsUrl:
        gpsData?.latitude != null && gpsData?.longitude != null
          ? `https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`
          : null,
    },
    software: pick(full, ['Software', 'ProcessingSoftware', 'HostComputer']),
    iptc: pick(full, [
      'Keywords',
      'Caption',
      'Headline',
      'Credit',
      'Copyright',
      'City',
      'Country',
      'Byline',
    ]),
    xmp: pick(full, ['Rating', 'Label', 'CreatorTool', 'DocumentID', 'HistorySoftwareAgent']),
    raw: full,
  };

  return NextResponse.json(report);
}