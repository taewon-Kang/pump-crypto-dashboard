import { NextRequest, NextResponse } from 'next/server';
import type { PriceType, CoinPerformance } from '@/types/performance';

export const maxDuration = 60;
// Function region is set project-wide via vercel.json ("regions": ["icn1"]).
// `preferredRegion` is deprecated in Next.js and no longer accepts region
// codes on Vercel — see src/app/api/klines/route.ts for details.

const UPBIT_BASE = 'https://api.upbit.com/v1';
const BINANCE_BASE = 'https://api.binance.com/api/v3';

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

const INTERVAL_MS: Record<string, number> = {
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
};

// Monday-aligned week floor (Binance/Upbit weeks start Monday UTC)
const MONDAY_EPOCH_MS = 4 * 86_400_000; // Jan 5 1970

function floorToCandle(ts: number, interval: string): number {
  if (interval === '1w') {
    const wk = INTERVAL_MS['1w'];
    return Math.floor((ts - MONDAY_EPOCH_MS) / wk) * wk + MONDAY_EPOCH_MS;
  }
  const ms = INTERVAL_MS[interval] ?? INTERVAL_MS['1h'];
  return Math.floor(ts / ms) * ms;
}

// ── Concurrency pool ─────────────────────────────────────────────────────────
async function withConcurrency<T>(
  tasks: (() => Promise<T | null>)[],
  concurrency: number
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let i = 0;

  async function worker() {
    for (;;) {
      const idx = i++;
      if (idx >= tasks.length) break;
      try {
        results[idx] = await tasks[idx]();
      } catch {
        results[idx] = null;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
  );
  return results;
}

// ── Upbit ────────────────────────────────────────────────────────────────────
function upbitPath(interval: string): string {
  if (interval === '1h') return '/candles/minutes/60';
  if (interval === '4h') return '/candles/minutes/240';
  if (interval === '1d') return '/candles/days';
  if (interval === '1w') return '/candles/weeks';
  return '/candles/minutes/60';
}

type UpbitRaw = Record<string, string | number>;

async function upbitFetch(url: string, retries = 3): Promise<UpbitRaw[] | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (res.status === 429) {
        // Back off and retry
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;

      const data = await res.json();
      return Array.isArray(data) ? (data as UpbitRaw[]) : null;
    } catch {
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 300));
    }
  }
  return null;
}

function parseUpbitCandle(d: UpbitRaw): Candle {
  return {
    open: d.opening_price as number,
    high: d.high_price as number,
    low: d.low_price as number,
    close: d.trade_price as number,
  };
}

/**
 * Fetch start and end candles for a single Upbit market.
 * When the range fits in ≤200 candles, use ONE request (range fetch).
 * Otherwise fall back to two sequential single-candle requests.
 */
async function fetchUpbitCandlePair(
  market: string,
  interval: string,
  startTs: number,
  endTs: number
): Promise<{ start: Candle | null; end: Candle | null }> {
  const iMs = INTERVAL_MS[interval] ?? INTERVAL_MS['1h'];
  const fStart = floorToCandle(startTs, interval);
  const fEnd = floorToCandle(endTs, interval);

  if (fStart === fEnd) {
    // Same candle — fetch once
    const toTs = fStart + iMs;
    const to = new Date(toTs).toISOString().replace('.000Z', 'Z');
    const url = `${UPBIT_BASE}${upbitPath(interval)}?market=${market}&count=1&to=${encodeURIComponent(to)}`;
    const data = await upbitFetch(url);
    if (!data?.length) return { start: null, end: null };
    const c = parseUpbitCandle(data[0]);
    return { start: c, end: c };
  }

  const candleCount = Math.round((fEnd - fStart) / iMs) + 1;

  if (candleCount <= 200) {
    // Single range request — Upbit returns most-recent first
    const toTs = fEnd + iMs;
    const to = new Date(toTs).toISOString().replace('.000Z', 'Z');
    const url = `${UPBIT_BASE}${upbitPath(interval)}?market=${market}&count=${candleCount}&to=${encodeURIComponent(to)}`;
    const data = await upbitFetch(url);
    if (!data?.length) return { start: null, end: null };

    // Find the candles closest to fStart and fEnd by timestamp
    const closestTo = (target: number) =>
      data.reduce<UpbitRaw | null>((best, cur) => {
        const t = new Date(cur.candle_date_time_utc as string).getTime();
        if (!best) return cur;
        const bt = new Date(best.candle_date_time_utc as string).getTime();
        return Math.abs(t - target) < Math.abs(bt - target) ? cur : best;
      }, null);

    const startRaw = closestTo(fStart);
    const endRaw = closestTo(fEnd);

    return {
      start: startRaw ? parseUpbitCandle(startRaw) : null,
      end: endRaw ? parseUpbitCandle(endRaw) : null,
    };
  }

  // Range too large — two sequential requests to avoid bursting rate limit
  const fetchSingle = async (ts: number): Promise<Candle | null> => {
    const floored = floorToCandle(ts, interval);
    const to = new Date(floored + iMs).toISOString().replace('.000Z', 'Z');
    const url = `${UPBIT_BASE}${upbitPath(interval)}?market=${market}&count=1&to=${encodeURIComponent(to)}`;
    const data = await upbitFetch(url);
    if (!data?.length) return null;
    return parseUpbitCandle(data[0]);
  };

  const start = await fetchSingle(startTs);
  const end = await fetchSingle(endTs);
  return { start, end };
}

// ── Binance ──────────────────────────────────────────────────────────────────
async function fetchBinanceCandle(
  symbol: string,
  interval: string,
  ts: number
): Promise<Candle | null> {
  const floored = floorToCandle(ts, interval);
  const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&startTime=${floored}&limit=1`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as (string | number)[][];
    if (!data?.length) return null;
    const d = data[0];
    return {
      open: parseFloat(d[1] as string),
      high: parseFloat(d[2] as string),
      low: parseFloat(d[3] as string),
      close: parseFloat(d[4] as string),
    };
  } catch {
    return null;
  }
}

function pick(candle: Candle, pt: PriceType): number {
  return candle[pt];
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const exchange = sp.get('exchange') as 'upbit' | 'binance';
  const interval = sp.get('interval') || '1d';
  const startTime = Number(sp.get('startTime'));
  const endTime = Number(sp.get('endTime'));
  const startPT = (sp.get('startPriceType') || 'close') as PriceType;
  const endPT = (sp.get('endPriceType') || 'close') as PriceType;

  if (!exchange || !startTime || !endTime) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }
  if (startTime >= endTime) {
    return NextResponse.json({ error: 'startTime must be before endTime' }, { status: 400 });
  }

  const t0 = Date.now();

  try {
    // ── Upbit ──────────────────────────────────────────────────────────────
    if (exchange === 'upbit') {
      const mRes = await fetch(`${UPBIT_BASE}/market/all?isDetails=false`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const allMarkets = (await mRes.json()) as { market: string; korean_name: string }[];
      const krwMarkets = allMarkets.filter((m) => m.market.startsWith('KRW-'));

      // One request per coin (range fetch) — concurrency 4 keeps us near 10 req/s
      const tasks = krwMarkets.map((m) => async (): Promise<CoinPerformance | null> => {
        const { start: sc, end: ec } = await fetchUpbitCandlePair(
          m.market,
          interval,
          startTime,
          endTime
        );
        if (!sc || !ec) return null;
        const sp2 = pick(sc, startPT);
        const ep = pick(ec, endPT);
        if (sp2 <= 0) return null;
        return {
          symbol: m.market.replace('KRW-', ''),
          name: m.korean_name,
          startPrice: sp2,
          endPrice: ep,
          change: ((ep - sp2) / sp2) * 100,
        };
      });

      const raw = await withConcurrency(tasks, 4);
      const results = raw.filter(Boolean) as CoinPerformance[];

      return NextResponse.json({
        results,
        totalCoins: krwMarkets.length,
        failedCoins: raw.filter((r) => r === null).length,
        durationMs: Date.now() - t0,
      });
    }

    // ── Binance ────────────────────────────────────────────────────────────
    const eiRes = await fetch(`${BINANCE_BASE}/exchangeInfo`, { cache: 'no-store' });
    const ei = (await eiRes.json()) as {
      symbols: {
        symbol: string;
        baseAsset: string;
        status: string;
        quoteAsset: string;
        isSpotTradingAllowed: boolean;
      }[];
    };
    const spotPairs = ei.symbols.filter(
      (s) => s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.isSpotTradingAllowed
    );

    const tasks = spotPairs.map((s) => async (): Promise<CoinPerformance | null> => {
      const [sc, ec] = await Promise.all([
        fetchBinanceCandle(s.symbol, interval, startTime),
        fetchBinanceCandle(s.symbol, interval, endTime),
      ]);
      if (!sc || !ec) return null;
      const sp2 = pick(sc, startPT);
      const ep = pick(ec, endPT);
      if (sp2 <= 0) return null;
      return {
        symbol: s.baseAsset,
        name: s.symbol,
        startPrice: sp2,
        endPrice: ep,
        change: ((ep - sp2) / sp2) * 100,
      };
    });

    const raw = await withConcurrency(tasks, 15);
    const results = raw.filter(Boolean) as CoinPerformance[];

    return NextResponse.json({
      results,
      totalCoins: spotPairs.length,
      failedCoins: raw.filter((r) => r === null).length,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
