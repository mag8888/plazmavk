import { prisma } from '../lib/prisma.js';

function stripQuotes(s: string): string {
  return String(s || '')
    .replace(/[«»„“”"]/g, '')
    .replace(/'/g, '') // remove straight apostrophes used as quotes in titles
    .trim();
}

function normalizeAndToRussian(s: string): string {
  return s
    .replace(/\s*&\s*/g, ' и ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pickRussianInParens(title: string): { base: string; ruParen?: string } {
  // Extract (...) that contains Cyrillic
  const m = title.match(/\(([^)]*[А-Яа-яЁё][^)]*)\)/);
  if (!m) return { base: title };
  const ru = String(m[1] || '').trim();
  const base = title.replace(m[0], '').trim();
  return { base, ruParen: ru };
}

const genitiveMap: Record<string, string> = {
  // minimal set for your catalog style
  'Шиповник': 'шиповника',
  'Клюква': 'клюквы',
  'Гранат': 'граната',
  'Малина': 'малины',
  'Огурец': 'огурца',
  'Имбирь': 'имбиря',
  'Лемонграсс': 'лемонграсса',
};

function toGenitivePhrase(phrase: string): string {
  // "Шиповник и Жожоба" -> "шиповника и Жожоба" (best-effort)
  const parts = normalizeAndToRussian(phrase).split(/\s+и\s+/i).map(p => p.trim()).filter(Boolean);
  const converted = parts.map((p, idx) => {
    // keep multiword phrases like "Черный Тмин" as-is, only map the first word if present
    const words = p.split(/\s+/).filter(Boolean);
    if (!words.length) return p;
    const first = words[0];
    const mapped = genitiveMap[first] || (idx === 0 ? first.toLowerCase() : first);
    words[0] = mapped;
    return words.join(' ');
  });
  return converted.join(' и ').replace(/\s{2,}/g, ' ').trim();
}

export function normalizeSiamTitle(input: string): string {
  let t = String(input || '').trim();
  if (!t) return t;

  // Keep only Russian part in parentheses when present
  const { base, ruParen } = pickRussianInParens(t);
  t = base;

  // Remove any remaining parentheses blocks (usually English)
  t = t.replace(/\([^)]*\)/g, ' ').trim();

  // Remove quotes and normalize & -> и
  t = normalizeAndToRussian(stripQuotes(t));

  // If we had RU in parentheses, use it as the “core name”
  if (ruParen) {
    const core = normalizeAndToRussian(stripQuotes(ruParen));

    // Special style: "Масло для лица Плоды шиповника и Жожоба"
    if (/^Масло для лица\b/i.test(t)) {
      return `Масло для лица Плоды ${toGenitivePhrase(core)}`.replace(/\s{2,}/g, ' ').trim();
    }

    // Generic: "Гель для душа Имбирь и Лемонграсс"
    if (/^(Гель для душа|Шампунь|Кондиционер для волос|Лосьон для тела|Очищающий крем|Очищающее масло для лица|Тоник|Скраб для лица)\b/i.test(t)) {
      return `${t} ${core}`.replace(/\s{2,}/g, ' ').trim();
    }
  }

  // If title contains an English core like "Ginger & Lemongrass" without RU, at least remove quotes and &
  return t;
}

export async function normalizeProductTitlesOnServer(opts?: { apply?: boolean; limit?: number }) {
  const apply = !!opts?.apply;
  const limit = Math.max(1, Math.min(Number(opts?.limit || 3000), 20000));

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true, title: true }
  });

  // Only touch titles that look “messy”: quotes/parens/&/latin
  const candidates = products.filter(p => /['"«»()&]/.test(p.title || '') || /[A-Za-z]/.test(p.title || ''));

  let changed = 0;
  let skipped = 0;
  const sample: Array<{ sku: string | null; before: string; after: string }> = [];

  for (const p of candidates.slice(0, limit)) {
    const before = String(p.title || '').trim();
    const after = normalizeSiamTitle(before);
    if (!after || after === before) {
      skipped++;
      continue;
    }

    if (apply) {
      await prisma.product.update({ where: { id: p.id }, data: { title: after } });
    }

    changed++;
    if (sample.length < 40) sample.push({ sku: (p.sku as any) ?? null, before, after });
  }

  return {
    apply,
    limit,
    candidates: candidates.length,
    changed: apply ? changed : 0,
    wouldChange: apply ? 0 : changed,
    skipped,
    sample,
  };
}

