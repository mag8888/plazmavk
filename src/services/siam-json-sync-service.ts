import { prisma } from '../lib/prisma.js';

type SiamJsonEntry = {
  title?: string;
  short_description?: string;
  full_description?: string;
  price?: string | number;
  sku?: string;
  volume?: string;
  ingredients?: string;
};

function normalizeSku(sku: string): string {
  return String(sku || '').trim().toUpperCase();
}

function extractVariantNumbersFromVolume(volume: string): string[] {
  const v = String(volume || '');
  // Support formats like:
  // - "90 мл / 220 мл"
  // - "470 мл (доступны 100/230 мл)"
  // - "25 г / 50 г / 100 г"
  // Important: do NOT use \\b with Cyrillic units (мл/г) — it breaks matching.
  const nums: string[] = [];
  const unitRe = /(\d{1,4}(?:\s*\/\s*\d{1,4})*)\s*(?:мл|ml|г|g)(?=\s|$|[),.\]])/giu;
  for (const m of v.matchAll(unitRe)) {
    const group = String(m[1] || '');
    for (const part of group.split('/')) {
      const n = part.trim();
      if (/^\d{1,4}$/.test(n)) nums.push(n);
    }
  }
  const seen = new Set<string>();
  return nums.filter(n => (seen.has(n) ? false : (seen.add(n), true)));
}

function expandSkuVariants(entry: SiamJsonEntry): string[] {
  const sku = normalizeSku(entry.sku || '');
  if (!sku) return [];
  const m = sku.match(/^([A-Z]{1,3}\d{4})-(\d{1,4})$/);
  if (!m) return [sku];
  const prefix = m[1];
  const nums = extractVariantNumbersFromVolume(entry.volume || '');
  if (!nums.length) return [sku];
  return nums.map(n => `${prefix}-${n}`);
}

function buildDescription(full: string, opts: { ingredients?: string; volume?: string; includeMeta?: boolean }): string {
  const base = String(full || '').trim();
  if (!opts.includeMeta) return base;

  const parts: string[] = [];
  if (base) parts.push(base);
  const ing = String(opts.ingredients || '').trim();
  const vol = String(opts.volume || '').trim();
  if (ing) parts.push(`Состав: ${ing}`);
  if (vol) parts.push(`Объем/вес: ${vol}`);
  return parts.join('\n\n').trim();
}

export async function syncProductsFromSiamJsonOnServer(args: {
  entries: SiamJsonEntry[];
  apply?: boolean;
  includeMetaInDescription?: boolean;
  limit?: number;
}) {
  const apply = !!args.apply;
  const includeMetaInDescription = args.includeMetaInDescription !== false; // default true
  const limit = Math.max(1, Math.min(Number(args.limit || 5000), 20000));

  const raw = Array.isArray(args.entries) ? args.entries : [];
  const expanded = new Map<string, SiamJsonEntry>();
  const duplicates: string[] = [];
  const invalid: Array<{ idx: number; reason: string }> = [];

  raw.slice(0, limit).forEach((e, idx) => {
    const skus = expandSkuVariants(e);
    if (!skus.length) {
      invalid.push({ idx, reason: 'missing sku' });
      return;
    }
    for (const sku of skus) {
      if (expanded.has(sku)) {
        duplicates.push(sku);
        continue;
      }
      expanded.set(sku, e);
    }
  });

  const products = await prisma.product.findMany({
    where: { sku: { not: null } },
    select: { id: true, sku: true, title: true, summary: true, description: true, price: true }
  });

  const bySku = new Map<string, (typeof products)[number]>();
  for (const p of products) {
    const sku = normalizeSku(p.sku || '');
    if (!sku) continue;
    if (!bySku.has(sku)) bySku.set(sku, p);
  }

  const jsonSkus = Array.from(expanded.keys());
  const dbSkus = Array.from(bySku.keys());

  const missingInDb = jsonSkus.filter(s => !bySku.has(s));
  const missingInJson = dbSkus.filter(s => !expanded.has(s));

  let matched = 0;
  let updated = 0;
  let skipped = 0;

  const sample: Array<{
    sku: string;
    before: { title: string; summary: string; description: string | null; price: number };
    after: { title: string; summary: string; description: string; price: number };
    changed: { title: boolean; summary: boolean; description: boolean; price: false };
  }> = [];

  for (const sku of jsonSkus) {
    const p = bySku.get(sku);
    if (!p) continue;
    const e = expanded.get(sku)!;
    matched++;

    const nextTitle = String(e.title || '').trim() || String(p.title || '').trim();
    const nextSummary = String(e.short_description || '').trim() || String(p.summary || '').trim();
    const nextDescription = buildDescription(String(e.full_description || ''), {
      ingredients: e.ingredients,
      volume: e.volume,
      includeMeta: includeMetaInDescription
    });

    const titleChanged = String(p.title || '').trim() !== nextTitle;
    const summaryChanged = String(p.summary || '').trim() !== nextSummary;
    const descChanged = String(p.description || '').trim() !== nextDescription.trim();

    if (!titleChanged && !summaryChanged && !descChanged) {
      skipped++;
      continue;
    }

    if (apply) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          title: nextTitle,
          summary: nextSummary,
          description: nextDescription
          // price intentionally untouched
        }
      });
      updated++;
    }

    if (sample.length < 20) {
      sample.push({
        sku,
        before: { title: p.title, summary: p.summary, description: p.description ?? null, price: p.price },
        after: { title: nextTitle, summary: nextSummary, description: nextDescription, price: p.price },
        changed: { title: titleChanged, summary: summaryChanged, description: descChanged, price: false }
      });
    }
  }

  return {
    apply,
    includeMetaInDescription,
    input: { entries: raw.length, limit },
    expandedSkus: expanded.size,
    duplicates: { count: duplicates.length, sample: duplicates.slice(0, 30) },
    invalid: { count: invalid.length, sample: invalid.slice(0, 30) },
    db: { totalWithSku: products.length },
    compare: {
      jsonSkus: jsonSkus.length,
      dbSkus: dbSkus.length,
      matched,
      missingInDb: { count: missingInDb.length, sample: missingInDb.slice(0, 50) },
      missingInJson: { count: missingInJson.length, sample: missingInJson.slice(0, 50) },
    },
    changes: { updated: apply ? updated : 0, wouldUpdate: apply ? 0 : (matched - skipped), skipped },
    sample,
  };
}

