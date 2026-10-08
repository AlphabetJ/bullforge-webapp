const PRICE_CACHE_TTL_MS = 60_000;
const PRICE_TIMEOUT_MS = 5_000;
const MAX_CACHE_ENTRIES = 500;

// Prices only: transactions and portfolio calculations are never cached here.
const priceCache = new Map();
const pendingPrices = new Map();

async function requestYahooPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      console.warn(`Yahoo Finance API returned status ${res.status} for ${symbol}`);
      return null;
    }
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol} from Yahoo Finance:`, error);
    return null;
  }
}

export async function fetchYahooPrice(symbol) {
  const key = symbol.toUpperCase().trim();
  const cached = priceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.price;
  priceCache.delete(key);

  if (pendingPrices.has(key)) return pendingPrices.get(key);

  const pending = requestYahooPrice(key).then(price => {
    // Failures are not cached, so the next request can try again.
    if (price !== null) {
      if (priceCache.size >= MAX_CACHE_ENTRIES) {
        priceCache.delete(priceCache.keys().next().value);
      }
      priceCache.set(key, { price, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
    }
    return price;
  }).finally(() => {
    pendingPrices.delete(key);
  });
  pendingPrices.set(key, pending);
  return pending;
}
