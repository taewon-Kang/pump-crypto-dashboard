import { fetchKlinesRange } from '@/lib/binance';
import type { KlineRaw } from '@/types';
import {
  EXTRA_POINT_LABELS,
  POINT_LABELS,
  REQUIRED_POINT_KEYS,
  type ParabolicCandleTuple,
  type ParabolicCase,
  type ParabolicMetrics,
  type ParabolicPoint,
  type ParabolicPoints,
  type ParabolicVolumeRatios,
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

/** log(end/start) / durationHours — trend strength independent of the leg's size. */
function slope(from: ParabolicPoint, to: ParabolicPoint): number {
  const hours = durationHours(from.time, to.time);
  return hours === 0 ? 0 : Math.log(to.price / from.price) / hours;
}

/** a/b, or null when b is ~zero (division would be meaningless/unstable) — keeps ratios ML-friendly instead of Infinity/NaN. */
function safeRatio(a: number, b: number): number | null {
  return Math.abs(b) < 1e-12 ? null : a / b;
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

/**
 * Validates the optional base-low/parabolic-start context points. Both are
 * independent of the core L0~L4 structure, so this only checks internal
 * consistency (positive values, base before start, start at/before L0) —
 * never required, never blocking a save when omitted.
 */
export function validateExtraPoints(
  points: ParabolicPoints,
  baseLow: ParabolicPoint | null,
  parabolicStart: ParabolicPoint | null
): void {
  if (baseLow && (!Number.isFinite(baseLow.time) || !Number.isFinite(baseLow.price) || baseLow.price <= 0)) {
    throw new Error(`${EXTRA_POINT_LABELS.baseLow} 값을 확인해주세요.`);
  }
  if (parabolicStart) {
    if (!Number.isFinite(parabolicStart.time) || !Number.isFinite(parabolicStart.price) || parabolicStart.price <= 0) {
      throw new Error(`${EXTRA_POINT_LABELS.parabolicStart} 값을 확인해주세요.`);
    }
    if (parabolicStart.time > points.l0.time) {
      throw new Error(`${EXTRA_POINT_LABELS.parabolicStart}은(는) ${POINT_LABELS.l0}보다 이전이거나 같은 시각이어야 합니다.`);
    }
  }
  if (baseLow && parabolicStart && baseLow.time > parabolicStart.time) {
    throw new Error(`${EXTRA_POINT_LABELS.baseLow}은(는) ${EXTRA_POINT_LABELS.parabolicStart}보다 이전 시각이어야 합니다.`);
  }
}

export function computeParabolicMetrics(points: ParabolicPoints): ParabolicMetrics {
  const { l0, h1, l1, h2, l2, h3, l3, r1, l4 } = points;

  const leg = (from: ParabolicPoint, to: ParabolicPoint) => ({
    pct: pctChange(from.price, to.price),
    durationHours: durationHours(from.time, to.time),
    slope: slope(from, to),
  });

  const l0ToH1 = leg(l0, h1);
  const h1ToL1 = leg(h1, l1);
  const l1ToH2 = leg(l1, h2);
  const h2ToL2 = leg(h2, l2);
  const l2ToH3 = leg(l2, h3);
  const h3ToL3 = leg(h3, l3);
  const l3ToR1 = leg(l3, r1);
  const r1ToL4 = l4 ? leg(r1, l4) : null;

  const lastPoint = l4 ?? r1;

  return {
    legs: { l0ToH1, h1ToL1, l1ToH2, h2ToL2, l2ToH3, h3ToL3, l3ToR1, r1ToL4 },
    riseSlopeRatio21: safeRatio(l1ToH2.slope, l0ToH1.slope),
    riseSlopeRatio32: safeRatio(l2ToH3.slope, l1ToH2.slope),
    risePctRatio21: safeRatio(l1ToH2.pct, l0ToH1.pct),
    risePctRatio32: safeRatio(l2ToH3.pct, l1ToH2.pct),
    retracement1Pct: h1.price === l0.price ? 0 : ((h1.price - l1.price) / (h1.price - l0.price)) * 100,
    retracement2Pct: h2.price === l1.price ? 0 : ((h2.price - l2.price) / (h2.price - l1.price)) * 100,
    h2BreakoutOverH1Pct: pctChange(h1.price, h2.price),
    h3BreakoutOverH2Pct: pctChange(h2.price, h3.price),
    totalRiseL0ToH3Pct: pctChange(l0.price, h3.price),
    durationL0ToH3Hours: durationHours(l0.time, h3.time),
    totalDurationHours: durationHours(l0.time, lastPoint.time),
    sweepDepthPct: pctChange(l2.price, l3.price) * -1, // positive when L3 < L2 (swept below the prior low)
    recoveryRatioPct: h3.price === l3.price ? 0 : ((r1.price - l3.price) / (h3.price - l3.price)) * 100,
    r1OverH3Pct: pctChange(h3.price, r1.price),
    l1VsL0Pct: pctChange(l0.price, l1.price),
    l2VsL1Pct: pctChange(l1.price, l2.price),
    l3VsL0Pct: pctChange(l0.price, l3.price),
    volumeRatios: { rise2OverRise1: null, rise3OverRise2: null, postDropOverRise3: null, reboundOverPostDrop: null }, // filled in by computeVolumeRatios once volumes are known
  };
}

export function computeVolumeRatios(volumes: ParabolicVolumes): ParabolicVolumeRatios {
  return {
    rise2OverRise1: safeRatio(volumes.rise2Vol, volumes.rise1Vol),
    rise3OverRise2: safeRatio(volumes.rise3Vol, volumes.rise2Vol),
    postDropOverRise3: safeRatio(volumes.postDropVol, volumes.rise3Vol),
    reboundOverPostDrop: safeRatio(volumes.reboundVol, volumes.postDropVol),
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

/**
 * Fetches the full run of Binance futures candles spanning L0 through
 * L4/R1 — a single paginated fetch reused for both the per-leg volume sums
 * and the raw OHLCV snapshot stored alongside the case.
 */
export async function fetchParabolicCandles(symbol: string, timeframe: string, points: ParabolicPoints): Promise<KlineRaw[]> {
  const lastPoint = points.l4 ?? points.r1;
  return fetchRangeKlinesPaged(symbol, timeframe, points.l0.time, lastPoint.time);
}

/**
 * Sums the already-fetched candles over each of the 7 legs from L0 through
 * R1. Each leg's window is [start, next) so consecutive legs never
 * double-count a boundary candle.
 */
export function computeParabolicVolumesFromCandles(candles: KlineRaw[], points: ParabolicPoints): ParabolicVolumes {
  const { l0, h1, l1, h2, l2, h3, l3, r1 } = points;
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

export function candlesToTuples(candles: KlineRaw[]): ParabolicCandleTuple[] {
  return candles.map((c) => [c.timestamp, c.open, c.high, c.low, c.close, c.volume]);
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

function pointFromColumns(time: Date | null, price: number | null): ParabolicPoint | null {
  return time && price != null ? { time: time.getTime(), price } : null;
}

export function serializeParabolicCase(row: ParabolicCaseRow): ParabolicCase {
  return {
    id: row.id,
    symbol: row.symbol,
    exchange: row.exchange,
    timeframe: row.timeframe,
    points: pointsFromRow(row),
    baseLow: pointFromColumns(row.baseLowTime, row.baseLowPrice),
    parabolicStart: pointFromColumns(row.parabolicStartTime, row.parabolicStartPrice),
    slopeCount: row.slopeCount,
    shapeType: row.shapeType,
    rise1Vol: row.rise1Vol,
    drop1Vol: row.drop1Vol,
    rise2Vol: row.rise2Vol,
    drop2Vol: row.drop2Vol,
    rise3Vol: row.rise3Vol,
    postDropVol: row.postDropVol,
    reboundVol: row.reboundVol,
    candles: (row.candles as unknown as ParabolicCandleTuple[] | null) ?? null,
    metrics: row.metrics as unknown as ParabolicMetrics,
    thirdWaveOccurred: row.thirdWaveOccurred,
    finalTopYn: row.finalTopYn,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
