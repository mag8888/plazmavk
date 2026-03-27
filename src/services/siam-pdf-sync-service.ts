import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../lib/prisma.js';
import { uploadImage, isCloudinaryConfigured } from './cloudinary-service.js';
import { aiTranslationService } from './ai-translation-service.js';
import { createRequire } from 'module';

// pdf-parse is CJS; use createRequire
const require = createRequire(import.meta.url);
let pdfParse = require('pdf-parse');
if (typeof pdfParse !== 'function' && pdfParse.default) pdfParse = pdfParse.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfPathPrimary = path.join(__dirname, '../../vital/каталог Siam Botanicals.pdf');
const pdfPathFallback = path.join(__dirname, '../../webapp/catalogue Siam Botanicals.pdf');

function normalizeWhitespace(s: string): string {
  return String(s || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isAllCapsLine(line: string): boolean {
  const s = String(line || '').trim();
  if (!s) return false;
  const lettersOnly = s.replace(/[^A-Za-zА-ЯЁа-яё\s]/g, '');
  if (!lettersOnly.trim()) return false;
  const hasLower = /[a-zа-яё]/.test(lettersOnly);
  const hasUpper = /[A-ZА-ЯЁ]/.test(lettersOnly);
  return hasUpper && !hasLower && lettersOnly.trim().length >= 6;
}

function extractFirstParagraph(text: string): string {
  const t = normalizeWhitespace(text);
  if (!t) return '';
  const parts = t.split(/\n\s*\n/);
  return (parts[0] || '').trim();
}

type CatalogEntry = {
  sku: string;
  title: string;
  summary: string;
  description: string;
  weight: string;
};

export function parseSiamCatalogFromPdfText(pdfText: string): Map<string, CatalogEntry> {
  const text = normalizeWhitespace(pdfText);
  const skuRe = /\b[A-Z]{1,3}\d{4}-\d{2,4}\b/g;
  const matches: Array<{ sku: string; index: number; length: number }> = [];
  for (const m of text.matchAll(skuRe)) {
    matches.push({ sku: m[0], index: (m.index ?? -1), length: m[0].length });
  }
  const seen = new Set<string>();
  const skus = matches.filter(m => {
    if (!m.sku || m.index < 0) return false;
    if (seen.has(m.sku)) return false;
    seen.add(m.sku);
    return true;
  });

  const result = new Map<string, CatalogEntry>();

  for (let i = 0; i < skus.length; i++) {
    const cur = skus[i];
    const prev = skus[i - 1];
    const blockStart = prev ? prev.index + prev.length : 0;
    const blockEnd = cur.index;
    if (blockEnd <= blockStart) continue;

    const blockRaw = text.substring(blockStart, blockEnd).trim();
    if (!blockRaw) continue;

    const afterSku = text.substring(cur.index, Math.min(text.length, cur.index + 160));
    const afterLine = afterSku.split('\n')[0] || afterSku;

    // Support SKU variants like: "SP0021-470 / 230 / 100 ВЕС: 470 г / 230 г / 100 г"
    // Build mapping sku -> weight (if available)
    const variants = new Map<string, string>();
    const prefixMatch = afterLine.match(/\b([A-Z]{1,3}\d{4})-(\d{2,4})\b/);
    const weightsPartMatch = afterLine.match(/ВЕС:\s*([^\n]+)/i);
    const weightNums = weightsPartMatch ? Array.from(weightsPartMatch[1].matchAll(/(\d+)\s*г/gi)).map(m => `${m[1]} г`) : [];

    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const nums: string[] = [];
      nums.push(prefixMatch[2]);
      const rest = afterLine.slice(prefixMatch.index! + prefixMatch[0].length);
      const beforeWeight = rest.split(/ВЕС:/i)[0] || '';
      for (const m of beforeWeight.matchAll(/\/\s*(\d{2,4})\b/g)) {
        nums.push(m[1]);
      }
      // Unique in order
      const seenNums = new Set<string>();
      const uniqNums = nums.filter(n => (seenNums.has(n) ? false : (seenNums.add(n), true)));
      uniqNums.forEach((n, idx) => {
        variants.set(`${prefix}-${n}`, weightNums[idx] || '');
      });
    }

    const lines = blockRaw.split('\n').map(l => l.trim()).filter(Boolean);
    const cleanedLines: string[] = [];
    for (const line of lines) {
      if (isAllCapsLine(line)) continue;
      cleanedLines.push(line);
    }

    const fullText = cleanedLines.join('\n').trim();
    if (fullText.length < 5) continue;

    const ingredientsIdx = fullText.lastIndexOf('ИНГРЕДИЕНТЫ:');
    let title = '';

    if (ingredientsIdx !== -1) {
      const before = fullText.slice(0, ingredientsIdx).trim();
      const beforeLines = before.split('\n').map(l => l.trim()).filter(Boolean);
      for (const l of beforeLines) {
        if (/^ДЛЯ\b/i.test(l)) continue;
        title = l;
        break;
      }
      if (!title) title = beforeLines[0] || '';
    } else {
      for (const l of cleanedLines) {
        if (/^ДЛЯ\b/i.test(l)) continue;
        title = l;
        break;
      }
      if (!title) title = cleanedLines[0] || '';
    }

    title = title.replace(/\s{2,}/g, ' ').trim();
    const summaryBase = extractFirstParagraph(fullText);
    const defaultWeight = variants.get(cur.sku) || '';
    const baseSummary = normalizeWhitespace(`${defaultWeight ? `ВЕС: ${defaultWeight}\n` : ''}${summaryBase}`).slice(0, 200);

    const description = normalizeWhitespace(fullText);

    // Save entry for the main SKU and for any variants on the same line
    if (variants.size > 0) {
      for (const [sku, w] of variants.entries()) {
        const sum = normalizeWhitespace(`${w ? `ВЕС: ${w}\n` : ''}${summaryBase}`).slice(0, 200);
        result.set(sku, { sku, title, summary: sum, description, weight: w });
      }
    } else {
      result.set(cur.sku, { sku: cur.sku, title, summary: baseSummary, description, weight: defaultWeight });
    }
  }

  return result;
}

function pickPdfPath(): string {
  if (fs.existsSync(pdfPathPrimary)) return pdfPathPrimary;
  return pdfPathFallback;
}

async function fetchPdfToTmp(pdfUrl: string): Promise<string> {
  const url = String(pdfUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('pdfUrl must start with http(s)://');
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch PDF: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) throw new Error('PDF is too small (download failed)');
    if (buf.length > 25 * 1024 * 1024) throw new Error('PDF is too large (>25MB)');
    const tmpPath = '/tmp/siam-catalog.pdf';
    fs.writeFileSync(tmpPath, buf);
    return tmpPath;
  } finally {
    clearTimeout(t);
  }
}

// ---- Image extraction (pdfjs-dist) ----
// We use a pragmatic pairing strategy:
// for each page: collect SKUs found on that page (in order) and images painted on that page (in order),
// then pair sku[i] -> image[i] (up to min length). This matches the Siam catalog layout.
async function extractImagesBySkuFromPdf(pdfPath: string): Promise<Map<string, Buffer>> {
  // Optional: pdfjs-dist not in package.json; image extraction skipped if missing
  let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    return new Map();
  }
  if (!pdfjs) return new Map();

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;

  const skuRe = /\b[A-Z]{1,3}\d{4}-\d{2,4}\b/g;
  const result = new Map<string, Buffer>();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = (await doc.getPage(p)) as {
      getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
      getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
      commonObjs: { get(name: string): unknown };
      objs: { get(name: string): unknown };
    };
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((it: any) => (it.str || '')).join(' ');
    const pageSkus = Array.from(new Set(pageText.match(skuRe) || []));
    if (pageSkus.length === 0) continue;

    const opList = await page.getOperatorList();
    const imgNames: string[] = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      // OPS.paintImageXObject = 85, OPS.paintJpegXObject = 82 in pdfjs, but use exported OPS constants for safety
      // In ESM build, OPS is under pdfjs.OPS
      // @ts-ignore
      if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintJpegXObject) {
        const args = opList.argsArray[i];
        const name = args && args[0];
        if (typeof name === 'string') imgNames.push(name);
      }
    }

    if (imgNames.length === 0) continue;

    // Pair in order (best-effort)
    const pairs = Math.min(pageSkus.length, imgNames.length);
    for (let i = 0; i < pairs; i++) {
      const sku = pageSkus[i] as string;
      if (result.has(sku)) continue;
      const imgName = imgNames[i] as string;

      // image data may be in commonObjs or objs
      let img: any = null;
      try {
        // @ts-ignore
        img = page.commonObjs.get(imgName);
      } catch (_) {}
      if (!img) {
        try {
          // @ts-ignore
          img = page.objs.get(imgName);
        } catch (_) {}
      }
      if (!img) continue;

      // img can be { data: Uint8ClampedArray, width, height } (raw RGBA)
      // or already a JPEG stream-like. We normalize to PNG using Canvas is not available server-side.
      // Pragmatic: if img.data is present and looks like RGB/RGBA, we encode as a simple PNG via a tiny encoder.
      if (img.data && img.width && img.height) {
        // tiny PNG encoder (no external deps) for RGBA
        const png = rgbaToPng(Buffer.from(img.data), img.width, img.height);
        result.set(sku, png);
      }
    }
  }

  return result;
}

// Minimal PNG encoder for RGBA buffers (uncompressed zlib)
// This is intentionally simple and “good enough” for product photos.
// (We avoid extra deps; Cloudinary will optimize on upload.)
function rgbaToPng(rgba: Buffer, width: number, height: number): Buffer {
  // Adapted minimal PNG structure: signature + IHDR + IDAT (zlib) + IEND
  const crc32 = (buf: Buffer) => {
    let crc = ~0;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return ~crc >>> 0;
  };

  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.concat([t, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, t, data, crc]);
  };

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Raw scanlines with filter byte 0 each row
  const rowSize = width * 4;
  const raw = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[(rowSize + 1) * y] = 0; // filter 0
    rgba.copy(raw, (rowSize + 1) * y + 1, rowSize * y, rowSize * (y + 1));
  }

  // zlib (deflate) - use node built-in
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(raw, { level: 6 });

  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, chunk('IHDR', ihdr), idat, iend]);
}

export async function syncSiamFromPdfOnServer(opts?: { updateImages?: boolean; pdfUrl?: string }) {
  const pdfUrl = String(opts?.pdfUrl || '').trim();
  const pdfPath = pdfUrl ? await fetchPdfToTmp(pdfUrl) : pickPdfPath();
  if (!fs.existsSync(pdfPath)) {
    if (!pdfUrl) {
      throw new Error(`PDF not found on server. Provide pdfUrl (direct link to .pdf) or add file at ${pdfPathPrimary} (or ${pdfPathFallback}).`);
    }
    throw new Error(`PDF not found at ${pdfPathPrimary} or ${pdfPathFallback}`);
  }

  const data = await pdfParse(fs.readFileSync(pdfPath));
  const catalog = parseSiamCatalogFromPdfText(data.text || '');

  const products = await prisma.product.findMany({
    where: { sku: { not: null } },
    select: { id: true, sku: true, title: true, summary: true, description: true, imageUrl: true }
  });

  let updatedText = 0;
  let matched = 0;
  let missingInPdf = 0;

  for (const p of products as any[]) {
    const sku = String(p.sku || '');
    const entry = catalog.get(sku);
    if (!entry) {
      missingInPdf++;
      continue; // leave as is
    }
    matched++;

    const titleChanged = String(p.title || '').trim() !== String(entry.title || '').trim();
    const summaryChanged = String(p.summary || '').trim() !== String(entry.summary || '').trim();
    const descChanged = String(p.description || '').trim() !== String(entry.description || '').trim();

    if (titleChanged || summaryChanged || descChanged) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          title: entry.title,
          summary: entry.summary,
          description: entry.description,
        }
      });
      updatedText++;
    }
  }

  let updatedImages = 0;
  let imagesExtracted = 0;
  let imagesSkipped = 0;

  if (opts?.updateImages) {
    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary not configured on server');
    }

    const imagesBySku = await extractImagesBySkuFromPdf(pdfPath);
    imagesExtracted = imagesBySku.size;

    for (const [sku, buf] of imagesBySku.entries()) {
      const product = await prisma.product.findFirst({ where: { sku }, select: { id: true } });
      if (!product) {
        imagesSkipped++;
        continue;
      }
      const up = await uploadImage(buf, {
        folder: 'vital/products',
        publicId: `pdf-${sku}`,
        resourceType: 'image'
      });
      await prisma.product.update({ where: { id: product.id }, data: { imageUrl: up.secureUrl } });
      updatedImages++;
    }
  }

  return {
    pdfPath,
    catalogEntries: catalog.size,
    productsTotalWithSku: products.length,
    matchedBySku: matched,
    missingInPdf,
    updatedText,
    images: {
      requested: !!opts?.updateImages,
      extracted: imagesExtracted,
      updated: updatedImages,
      skipped: imagesSkipped,
    }
  };
}

function looksLatinOnlyTitle(title: string): boolean {
  const t = String(title || '').trim();
  if (!t) return false;
  return /[A-Za-z]/.test(t) && !/[А-Яа-яЁё]/.test(t);
}

function cleanupEnglishTitleForTranslation(title: string): string {
  let t = String(title || '').trim();
  // Remove long marketing tails like "-COSMOS ...", extra certifications, etc.
  t = t.replace(/\s*-+\s*COSMOS[\s\S]*$/i, '').trim();
  t = t.replace(/\s*-+\s*certified[\s\S]*$/i, '').trim();
  // Normalize weight units
  t = t.replace(/\b(\d+)\s*G\b/gi, '$1 g');
  // Collapse whitespace
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
}

function fallbackTranslateTitleRu(englishTitle: string): string {
  // Very small “good-enough” dictionary for common Siam titles
  // If AI is configured, we won't use this.
  let t = cleanupEnglishTitleForTranslation(englishTitle);

  // Weight to Russian 'г'
  t = t.replace(/\b(\d+)\s*g\b/gi, '$1 г');

  const rules: Array<[RegExp, string]> = [
    [/^Body Wash\b/i, 'Гель для душа'],
    [/^Body Lotion\b/i, 'Лосьон для тела'],
    [/^Hair Conditioner\b/i, 'Кондиционер для волос'],
    [/^Hair Shampoo\b/i, 'Шампунь для волос'],
    [/^Hair Treatment\b/i, 'Средство для ухода за волосами'],
    [/^Face Milk Cleanser\b/i, 'Молочко для умывания'],
    [/^Aloe Pure Milk Cleanser\b/i, 'Молочко для умывания с алоэ'],
    [/^Face Polish\b/i, 'Скраб для лица'],
    [/^Lip Balm\b/i, 'Бальзам для губ'],
    [/^Mineral Sun Protection\b/i, 'Минеральная солнцезащита для лица'],
    [/^Sun Protection\b/i, 'Солнцезащитное средство'],
  ];

  for (const [re, ru] of rules) {
    if (re.test(t)) {
      // Keep the rest after the matched prefix
      const rest = t.replace(re, '').trim();
      return (ru + (rest ? ` ${rest}` : '')).replace(/\s{2,}/g, ' ').trim();
    }
  }

  // Fallback: just return cleaned title (better than raw)
  return t;
}

export async function translateRemainingTitlesToRussianOnServer(opts?: { limit?: number }) {
  const limit = Math.max(1, Math.min(Number(opts?.limit || 200), 2000));

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, title: true }
  });

  const candidates = products.filter(p => looksLatinOnlyTitle(p.title || ''));

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const sample: Array<{ sku: string | null; before: string; after: string; method: string }> = [];

  for (const p of candidates.slice(0, limit)) {
    const before = String(p.title || '').trim();
    const cleaned = cleanupEnglishTitleForTranslation(before);

    try {
      let after = '';
      let method = 'fallback';

      if (aiTranslationService.isEnabled()) {
        after = await aiTranslationService.translateTitle(cleaned);
        method = 'ai';
      } else {
        after = fallbackTranslateTitleRu(cleaned);
      }

      after = String(after || '').trim();
      if (!after || after === before) {
        skipped++;
        continue;
      }

      await prisma.product.update({
        where: { id: p.id },
        data: { title: after }
      });

      updated++;
      if (sample.length < 20) {
        sample.push({ sku: (p.sku as any) ?? null, before, after, method });
      }
    } catch (e) {
      failed++;
      continue;
    }
  }

  return {
    candidates: candidates.length,
    limit,
    updated,
    skipped,
    failed,
    aiEnabled: aiTranslationService.isEnabled(),
    sample,
  };
}
