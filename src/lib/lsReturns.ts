import { fetchKlinesRange, fetchLatestPrice } from '@/lib/binance';
import type { KlineRaw } from '@/types';
import type { Side } from '@/generated/prisma/enums';

export type CheckpointKey = '3d' | '7d' | '14d' | '30d' | 'now';

export interface CheckpointMetric {
  /** Whether this checkpoint's target time has actually passed. */
  elapsed: boolean;
  /** Target timestamp (ms) this checkpoint refers to. */
  atTime: number;
  /** Return % at exactly this checkpoint (null while pending). */
  returnPct: number | null;
  /** Best return % attainable at any point between entry and this checkpoint. */
  bestPct: number;
  /** Worst return % (deepest drawdown) attainable in that same window. */
  worstPct: number;
}

export interface LsMetrics {
  currentPrice: number;
  checkpoints: Record<CheckpointKey, CheckpointMetric>;
}

const OFFSETS_MS: Record<Exclude<CheckpointKey, 'now'>, number> = {
  '3d': 3 * 86_400_000,
  '7d': 7 * 86_400_000,
  '14d': 14 * 86_400_000,
  '30d': 30 * 86_400_000,
};

// Long profits when price rises, short profits when price falls — mirror the sign.
export function directionalReturn(price: number, entryPrice: number, side: Side): number {
  const raw = ((price - entryPrice) / entryPrice) * 100;
  return side === 'LONG' ? raw : -raw;
}

/**
 * Computes checkpoint returns (+3d/+7d/+14d/+30d/now) plus the best- and
 * worst-case return reachable within each window, from a single Binance
 * futures 1h-kline fetch covering [entryTime, min(now, entryTime+30d)].
 */
export async function computeLsMetrics(
  symbol: string,
  side: Side,
  entryTimeMs: number,
  entryPrice: number
): Promise<LsMetrics> {
  const now = Date.now();
  const rangeEnd = Math.min(now, entryTimeMs + OFFSETS_MS['30d']);

  let candles: KlineRaw[] = [];
  if (rangeEnd > entryTimeMs) {
    candles = await fetchKlinesRange(symbol, '1h', 'futures', entryTimeMs, rangeEnd, 750);
  }

  function priceAt(targetTime: number): number | null {
    if (!candles.length) return null;
    let chosen: KlineRaw = candles[0];
    for (const c of candles) {
      if (c.timestamp > targetTime) break;
      chosen = c;
    }
    return chosen.close;
  }

  function bestWorstWithin(targetTime: number): { best: number; worst: number } {
    let hi = -Infinity;
    let lo = Infinity;
    for (const c of candles) {
      if (c.timestamp > targetTime) break;
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    }
    if (hi === -Infinity) {
      hi = entryPrice;
      lo = entryPrice;
    }
    const a = directionalReturn(hi, entryPrice, side);
    const b = directionalReturn(lo, entryPrice, side);
    return { best: Math.max(a, b), worst: Math.min(a, b) };
  }

  let currentPrice = candles.length ? candles[candles.length - 1].close : entryPrice;
  if (!candles.length) {
    currentPrice = await fetchLatestPrice(symbol, 'futures').catch(() => entryPrice);
  }

  const checkpoints = {} as Record<CheckpointKey, CheckpointMetric>;

  for (const key of Object.keys(OFFSETS_MS) as Exclude<CheckpointKey, 'now'>[]) {
    const atTime = entryTimeMs + OFFSETS_MS[key];
    const elapsed = now >= atTime;
    const windowEnd = Math.min(now, atTime);
    const p = elapsed ? priceAt(atTime) : null;
    const { best, worst } = bestWorstWithin(windowEnd);
    checkpoints[key] = {
      elapsed,
      atTime,
      returnPct: p !== null ? directionalReturn(p, entryPrice, side) : null,
      bestPct: best,
      worstPct: worst,
    };
  }

  const { best: nowBest, worst: nowWorst } = bestWorstWithin(now);
  checkpoints.now = {
    elapsed: true,
    atTime: now,
    returnPct: directionalReturn(currentPrice, entryPrice, side),
    bestPct: nowBest,
    worstPct: nowWorst,
  };

  return { currentPrice, checkpoints };
}

/**
 * Reprices the "now" checkpoint from a live WS tick — no network round-trip.
 * Extends that checkpoint's running best/worst so a live excursion isn't lost
 * once the REST-computed snapshot is superseded.
 */
export function applyLivePrice(metrics: LsMetrics, side: Side, entryPrice: number, livePrice: number): LsMetrics {
  const liveReturn = directionalReturn(livePrice, entryPrice, side);
  const now = metrics.checkpoints.now;
  return {
    currentPrice: livePrice,
    checkpoints: {
      ...metrics.checkpoints,
      now: {
        ...now,
        returnPct: liveReturn,
        bestPct: Math.max(now.bestPct, liveReturn),
        worstPct: Math.min(now.worstPct, liveReturn),
      },
    },
  };
}

/** Snapshot the entry price at write time from the 1m candle covering entryTime. */
export async function resolveEntryPrice(symbol: string, entryTimeMs: number): Promise<number> {
  const floored = Math.floor(entryTimeMs / 60_000) * 60_000;
  const candles = await fetchKlinesRange(symbol, '1m', 'futures', floored, floored + 60_000, 1);
  if (candles.length) return candles[0].open;
  // Entry time too recent to have a closed candle yet — use the live price.
  return fetchLatestPrice(symbol, 'futures');
}
