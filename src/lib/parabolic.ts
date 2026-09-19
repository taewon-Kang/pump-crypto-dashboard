import { fetchKlinesRange } from '@/lib/binance';
import type { KlineRaw } from '@/types';
import {
  POINT_LABELS,
  REQUIRED_POINT_KEYS,
  type ParabolicCase,
  type ParabolicMetrics,
  type ParabolicPoints,
  type ParabolicVolumes,
  type RequiredPointKey,
} from '@/types/parabolic';
import type { ParabolicCase as ParabolicCaseRow } from '@/generated/prisma/client';

const HOUR_MS = 3_600_000;

function pctChange(from: number, to: number): number {
  return ((to - from) / from) * 100;
}

function durationHours(fromMs: number, toMs: number): number {
  return (toMs - fromMs) / HOUR_MS;
}

/** Validates chronological order and positive prices; throws with a Korean message on the first violation. */
export function validateParabolicPoints(points: ParabolicPoints): void {
  const ordered: RequiredPointKey[] = [...REQUIRED_POINT_KEYS];
  for (const key of ordered) {
    const p = points[key];
    if (!p || !Number.isFinite(p.time) || !Number.isFinite(p.price) || p.price <= 0) {
      throw new Error(`${POINT_LABELS[key]} 값을 확인해주세요.`);
    }
  }
  for (let i = 1; i < ordered.length; i++) {
    const prev = points[ordered[i - 1]];
    const cur = points[ordered[i]];
    if (cur.time <= prev.time) {
      throw new Error(
        `${POINT_LABELS[ordered[i]]}은(는) ${POINT_LABELS[ordered[i - 1]]}보다 이후 시각이어야 합니다.`
      );
    }
  }
  if (points.l4) {
    if (!Number.isFinite(points.l4.time) || !Number.isFinite(points.l4.price) || points.l4.price <= 0) {
      throw new Error(`${POINT_LABELS.l4} 값을 확인해주세요.`);
    }
    if (points.l4.time <= points.r1.time) {
      throw new Error(`${POINT_LABELS.l4}은(는) ${POINT_LABELS.r1}보다 이후 시각이어야 합니다.`);
    }
  }
  const lastTime = points.l4?.time ?? points.r1.time;
  if (lastTime > Date.now()) {
    throw new Error('미래 시각은 입력할 수 없습니다.');
  }
}

export function computeParabolicMetrics(points: ParabolicPoints): ParabolicMetrics {
  const { l0, h1, l1, h2, l2, h3, l3, r1, l4 } = points;

  const leg = (from: { time: number; price: number }, to: { time: number; price: number }) => ({
    pct: pctChange(from.price, to.price),
    durationHours: durationHours(from.time, to.time),
  });

  const lastPoint = l4 ?? r1;

  return {
    legs: {
      l0ToH1: leg(l0, h1),
      h1ToL1: leg(h1, l1),
      l1ToH2: leg(l1, h2),
      h2ToL2: leg(h2, l2),
      l2ToH3: leg(l2, h3),
      h3ToL3: leg(h3, l3),
      l3ToR1: leg(l3, r1),
      r1ToL4: l4 ? leg(r1, l4) : null,
    },
    totalRisePct: pctChange(l0.price, h3.price),
    totalDurationHours: durationHours(l0.time, lastPoint.time),
    retrace1Pct: h1.price === l0.price ? 0 : ((h1.price - l1.price) / (h1.price - l0.price)) * 100,
    retrace2Pct: h2.price === l1.price ? 0 : ((h2.price - l2.price) / (h2.price - l1.price)) * 100,
    reboundRetracePct: h3.price === l3.price ? 0 : ((r1.price - l3.price) / (h3.price - l3.price)) * 100,
    l1VsL0Pct: pctChange(l0.price, l1.price),
    l2VsL1Pct: pctChange(l1.price, l2.price),
    l3VsL0Pct: pctChange(l0.price, l3.price),
  };
}

/** Fetches every candle in [startTime, endTime], paginating past Binance's per-call candle limit. */
async function fetchRangeKlinesPaged(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<KlineRaw[]> {
  const LIMIT = 1500; // futures max
  const MAX_PAGES = 50; // safety cap — comfortably covers months of 1m candles
  const candles: KlineRaw[] = [];
  let cursor = startTime;

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await fetchKlinesRange(symbol, interval, 'futures', cursor, endTime, LIMIT);
    if (!batch.length) break;
    candles.push(...batch);
    const last = batch[batch.length - 1];
    if (batch.length < LIMIT || last.timestamp >= endTime) break;
    cursor = last.timestamp + 1;
  }

  return candles;
}

/** Reassembles the individual DB time/price columns back into the point-keyed shape the UI and export use. */
export function pointsFromRow(row: ParabolicCaseRow): ParabolicPoints {
  return {
    l0: { time: row.l0Time.getTime(), price: row.l0Price },
    h1: { time: row.h1Time.getTime(), price: row.h1Price },
    l1: { time: row.l1Time.getTime(), price: row.l1Price },
    h2: { time: row.h2Time.getTime(), price: row.h2Price },
    l2: { time: row.l2Time.getTime(), price: row.l2Price },
    h3: { time: row.h3Time.getTime(), price: row.h3Price },
    l3: { time: row.l3Time.getTime(), price: row.l3Price },
    r1: { time: row.r1Time.getTime(), price: row.r1Price },
    l4: row.l4Time && row.l4Price != null ? { time: row.l4Time.getTime(), price: row.l4Price } : null,
  };
}

export function serializeParabolicCase(row: ParabolicCaseRow): ParabolicCase {
  return {
    id: row.id,
    symbol: row.symbol,
    timeframe: row.timeframe,
    points: pointsFromRow(row),
    rise1Vol: row.rise1Vol,
    drop1Vol: row.drop1Vol,
    rise2Vol: row.rise2Vol,
    drop2Vol: row.drop2Vol,
    rise3Vol: row.rise3Vol,
    postDropVol: row.postDropVol,
    reboundVol: row.reboundVol,
    metrics: row.metrics as unknown as ParabolicMetrics,
    finalTopYn: row.finalTopYn,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Sums Binance futures kline volume over each of the 7 legs from L0 through
 * R1, from a single paginated fetch of the full range — cheaper than one
 * fetch per leg. Each leg's window is [start, next) so consecutive legs
 * never double-count a boundary candle.
 */
export async function computeParabolicVolumes(
  symbol: string,
  timeframe: string,
  points: ParabolicPoints
): Promise<ParabolicVolumes> {
  const { l0, h1, l1, h2, l2, h3, l3, r1 } = points;
  const candles = await fetchRangeKlinesPaged(symbol, timeframe, l0.time, r1.time);

  const sumBetween = (startMs: number, endMs: number) =>
    candles.reduce((sum, c) => (c.timestamp >= startMs && c.timestamp < endMs ? sum + c.volume : sum), 0);

  return {
    rise1Vol: sumBetween(l0.time, h1.time),
    drop1Vol: sumBetween(h1.time, l1.time),
    rise2Vol: sumBetween(l1.time, h2.time),
    drop2Vol: sumBetween(h2.time, l2.time),
    rise3Vol: sumBetween(l2.time, h3.time),
    postDropVol: sumBetween(h3.time, l3.time),
    reboundVol: sumBetween(l3.time, r1.time),
  };
}
