// app/api/doc-metadata/route.ts
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { PDFParse } from 'pdf-parse';

interface DocMetadata {
  fileInfo: {
    name: string;
    sizeBytes: number;
    type: string;
  };
  core: Record<string, any>;
  app: Record<string, any>;
}

async function extractPdfMetadata(buffer: Buffer): Promise<Record<string, any>> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getInfo();
    const info = result.info ?? {};
    const dates = result.getDateNode?.() ?? {};
    return {
      Title: info.Title,
      Author: info.Author,
      Subject: info.Subject,
      Keywords: info.Keywords,
      Creator: info.Creator,
      Producer: info.Producer,
      CreationDate: dates.CreationDate ?? info.CreationDate,
      ModDate: dates.ModDate ?? info.ModDate,
      PageCount: result.total,
    };
  } finally {
    await parser.destroy();
  }
}

async function extractOfficeMetadata(
  buffer: Buffer,
): Promise<{ core: Record<string, any>; app: Record<string, any> }> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({ ignoreAttributes: false });

  const core: Record<string, any> = {};
  const app: Record<string, any> = {};

  const coreFile = zip.file('docProps/core.xml');
  if (coreFile) {
    const xml = await coreFile.async('text');
    const parsed = parser.parse(xml);
    const props = parsed['cp:coreProperties'] ?? parsed.coreProperties ?? {};
    for (const [key, value] of Object.entries(props)) {
      const cleanKey = key.replace(/^.*:/, ''); // убираем namespace-префикс (dc:, cp:, dcterms:)
      if (typeof value === 'object' && value !== null && '#text' in (value as any)) {
        core[cleanKey] = (value as any)['#text'];
      } else {
        core[cleanKey] = value;
      }
    }
  }

  const appFile = zip.file('docProps/app.xml');
  if (appFile) {
    const xml = await appFile.async('text');
    const parsed = parser.parse(xml);
    const props = parsed.Properties ?? {};
    for (const [key, value] of Object.entries(props)) {
      if (typeof value !== 'object') app[key] = value;
    }
  }

  return { core, app };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('document');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isOffice = /\.(docx|pptx|xlsx)$/i.test(file.name);

  if (!isPdf && !isOffice) {
    return NextResponse.json(
      { error: 'unsupported_format', detail: 'Поддерживаются только PDF, DOCX, PPTX, XLSX' },
      { status: 400 },
    );
  }

  try {
    let result: DocMetadata;

    if (isPdf) {
      const core = await extractPdfMetadata(buffer);
      result = {
        fileInfo: { name: file.name, sizeBytes: file.size, type: 'PDF' },
        core,
        app: {},
      };
    } else {
      const { core, app } = await extractOfficeMetadata(buffer);
      result = {
        fileInfo: { name: file.name, sizeBytes: file.size, type: 'Office (DOCX/PPTX/XLSX)' },
        core,
        app,
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('doc-metadata parse error:', err);
    return NextResponse.json(
      { error: 'parse_failed', detail: 'Не удалось прочитать метаданные этого файла' },
      { status: 500 },
    );
  }
}