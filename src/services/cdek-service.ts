type CdekTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds
};

type CdekCity = {
  code: number;
  city: string;
  region?: string;
  country_code?: string;
};

type CdekTariffResponse = {
  delivery_sum?: number;
  total_sum?: number;
  period_min?: number;
  period_max?: number;
  errors?: Array<{ code?: string; message?: string }>;
};

type QuoteArgs = {
  clientId: string;
  clientSecret: string;
  fromCity: string;
  toCity: string;
  // pickup: склад-склад (ПВЗ), courier: склад-дверь
  method: 'pickup' | 'courier';
  weightGrams: number;
};

let tokenCache: { token: string; expiresAtMs: number } | null = null;
const cityCodeCache = new Map<string, { code: number; ts: number }>();

function nowMs() {
  return Date.now();
}

function cacheKey(city: string) {
  return String(city || '').trim().toLowerCase();
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 12_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: ac.signal });
    const data = await resp.json().catch(() => ({}));
    return { resp, data };
  } finally {
    clearTimeout(t);
  }
}

async function getCdekToken(clientId: string, clientSecret: string): Promise<string> {
  const cached = tokenCache;
  if (cached && cached.token && cached.expiresAtMs > nowMs() + 30_000) {
    return cached.token;
  }

  const url = 'https://api.cdek.ru/v2/oauth/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });

  const { resp, data } = await fetchJson(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!resp.ok) {
    throw new Error(`CDEK auth failed: ${resp.status} ${(data && (data.message || data.error_description || data.error)) || ''}`.trim());
  }
  const parsed = data as CdekTokenResponse;
  if (!parsed?.access_token) throw new Error('CDEK auth failed: no access_token');
  tokenCache = { token: parsed.access_token, expiresAtMs: nowMs() + (Number(parsed.expires_in || 900) * 1000) };
  return parsed.access_token;
}

async function resolveCityCode(token: string, city: string): Promise<number> {
  const key = cacheKey(city);
  const cached = cityCodeCache.get(key);
  if (cached && nowMs() - cached.ts < 7 * 24 * 60 * 60 * 1000) {
    return cached.code;
  }

  const url = `https://api.cdek.ru/v2/location/cities?country_codes=RU&city=${encodeURIComponent(city)}&size=5`;
  const { resp, data } = await fetchJson(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    throw new Error(`CDEK city resolve failed: ${resp.status}`);
  }

  const list = Array.isArray(data) ? (data as CdekCity[]) : [];
  const best = list.find(x => String(x.city || '').toLowerCase() === String(city || '').toLowerCase()) || list[0];
  const code = Number(best?.code || 0);
  if (!code) throw new Error(`CDEK city resolve failed: no code for "${city}"`);

  cityCodeCache.set(key, { code, ts: nowMs() });
  return code;
}

export async function getCdekQuote(args: QuoteArgs): Promise<{ priceRub: number; periodMin?: number; periodMax?: number }> {
  const token = await getCdekToken(args.clientId, args.clientSecret);
  const fromCode = await resolveCityCode(token, args.fromCity);
  const toCode = await resolveCityCode(token, args.toCity);

  // Common tariff codes:
  // 136 — склад-склад (ПВЗ/терминал), 137 — склад-дверь (курьер)
  const tariffCode = args.method === 'pickup' ? 136 : 137;
  const weight = Math.max(1, Math.round(Number(args.weightGrams || 1)));

  const url = 'https://api.cdek.ru/v2/calculator/tariff';
  const payload = {
    tariff_code: tariffCode,
    from_location: { code: fromCode },
    to_location: { code: toCode },
    packages: [{ weight }]
  };

  const { resp, data } = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const msg = (data?.errors && Array.isArray(data.errors) && data.errors[0]?.message) ? data.errors[0].message : '';
    throw new Error(`CDEK tariff failed: ${resp.status} ${msg}`.trim());
  }

  const parsed = data as CdekTariffResponse;
  const price = Number(parsed?.total_sum ?? parsed?.delivery_sum ?? 0);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('CDEK tariff failed: no price');
  }
  return { priceRub: Math.round(price), periodMin: parsed.period_min, periodMax: parsed.period_max };
}

