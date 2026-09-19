/** Ordered structural points of a parabolic pump case. `l4` is the only optional one. */
export const REQUIRED_POINT_KEYS = ['l0', 'h1', 'l1', 'h2', 'l2', 'h3', 'l3', 'r1'] as const;
export const POINT_KEYS = [...REQUIRED_POINT_KEYS, 'l4'] as const;
export type PointKey = (typeof POINT_KEYS)[number];
export type RequiredPointKey = (typeof REQUIRED_POINT_KEYS)[number];

export const POINT_LABELS: Record<PointKey, string> = {
  l0: '시작 저점 (L0)',
  h1: '1차 고점 (H1)',
  l1: '1차 저점 (L1)',
  h2: '2차 고점 (H2)',
  l2: '2차 저점 (L2)',
  h3: '3차 고점 (H3)',
  l3: '하락 저점 (L3)',
  r1: '반등 고점 (R1)',
  l4: '다음 하락 저점 (L4, 선택)',
};

/**
 * Extra, independent context points — not part of the L0~L4 structure or its
 * volume/metric legs. Kept separate on purpose: `baseLow` is the true bottom
 * before a long consolidation and `parabolicStart` is where the actual
 * acceleration began, so a "4-stage" view (from the base) and a "3-stage"
 * view (from the breakout) of the same case can be compared later.
 */
export const EXTRA_POINT_KEYS = ['baseLow', 'parabolicStart'] as const;
export type ExtraPointKey = (typeof EXTRA_POINT_KEYS)[number];

export const EXTRA_POINT_LABELS: Record<ExtraPointKey, string> = {
  baseLow: '전체 바닥 (Base Low, 선택)',
  parabolicStart: '가속 시작점 (Parabolic Start, 선택)',
};

export const ALL_POINT_KEYS = [...POINT_KEYS, ...EXTRA_POINT_KEYS] as const;
export type AnyPointKey = PointKey | ExtraPointKey;

export const ALL_POINT_LABELS: Record<AnyPointKey, string> = { ...POINT_LABELS, ...EXTRA_POINT_LABELS };

export interface ParabolicPoint {
  time: number; // epoch ms
  price: number;
}

export type ParabolicPoints = Record<RequiredPointKey, ParabolicPoint> & { l4: ParabolicPoint | null };

export const TIMEFRAME_OPTIONS = ['30m', '1h', '4h', '1d', '1w'] as const;
export type Timeframe = (typeof TIMEFRAME_OPTIONS)[number];

export const SHAPE_TYPES = ['LINEAR', 'CURVE', 'MIXED'] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];
export const SHAPE_TYPE_LABELS: Record<ShapeType, string> = {
  LINEAR: '직선형',
  CURVE: '곡선형',
  MIXED: '혼합형',
};

export interface LegMetric {
  /** Signed % price change over the leg (rise legs positive, drop legs negative). */
  pct: number;
  durationHours: number;
  /** log(endPrice / startPrice) / durationHours — trend strength, independent of the leg's size. */
  slope: number;
}

export interface ParabolicVolumeRatios {
  rise2OverRise1: number | null;
  rise3OverRise2: number | null;
  postDropOverRise3: number | null;
  reboundOverPostDrop: number | null;
}

export interface ParabolicMetrics {
  legs: {
    l0ToH1: LegMetric;
    h1ToL1: LegMetric;
    l1ToH2: LegMetric;
    h2ToL2: LegMetric;
    l2ToH3: LegMetric;
    h3ToL3: LegMetric;
    l3ToR1: LegMetric;
    r1ToL4: LegMetric | null;
  };
  /** Rise-leg slope/%-move momentum between consecutive rise legs (l0ToH1 -> l1ToH2 -> l2ToH3). Null when the denominator leg has ~zero slope/move. */
  riseSlopeRatio21: number | null;
  riseSlopeRatio32: number | null;
  risePctRatio21: number | null;
  risePctRatio32: number | null;
  /** % of the L0->H1 gain given back by the L1 pullback. */
  retracement1Pct: number;
  /** % of the L1->H2 gain given back by the L2 pullback. */
  retracement2Pct: number;
  /** How far H2 broke out above H1, and H3 above H2. */
  h2BreakoutOverH1Pct: number;
  h3BreakoutOverH2Pct: number;
  /** Overall pump size/duration for the run itself, L0 -> H3 (excludes the post-top phase). */
  totalRiseL0ToH3Pct: number;
  durationL0ToH3Hours: number;
  /** Full logged structure's span, L0 -> R1 (or L0 -> L4 when set). */
  totalDurationHours: number;
  /** How far L3 broke below L2 — positive means L3 swept below the prior low, negative/zero means it held above it. */
  sweepDepthPct: number;
  /** % of the H3->L3 drop that the R1 rebound recovered. */
  recoveryRatioPct: number;
  /** How close R1 got back to H3 itself (negative = still below H3). */
  r1OverH3Pct: number;
  /** Higher-low checks vs. the prior structural low. */
  l1VsL0Pct: number;
  l2VsL1Pct: number;
  l3VsL0Pct: number;
  volumeRatios: ParabolicVolumeRatios;
}

export interface ParabolicVolumes {
  rise1Vol: number;
  drop1Vol: number;
  rise2Vol: number;
  drop2Vol: number;
  rise3Vol: number;
  postDropVol: number;
  reboundVol: number;
}

/** Compact OHLCV row — matches Binance's own kline array order, cheaper to store/transfer than keyed objects. */
export type ParabolicCandleTuple = [timestamp: number, open: number, high: number, low: number, close: number, volume: number];

export interface ParabolicCaseInput {
  symbol: string;
  /** Always "binance" today — stored explicitly in case another exchange is added later. */
  exchange: string;
  timeframe: string;
  points: ParabolicPoints;
  baseLow: ParabolicPoint | null;
  parabolicStart: ParabolicPoint | null;
  /** Visually-judged count of major slope segments (2, 3, 4, ...). */
  slopeCount: number | null;
  shapeType: ShapeType | null;
  /** Label: did a meaningful 3rd-wave rise actually happen after L2? Revisable later. */
  thirdWaveOccurred: boolean | null;
  /** Label: did H3 end up being the final top? Revisable later. */
  finalTopYn: boolean | null;
  notes: string | null;
}

export interface ParabolicCase extends ParabolicCaseInput, ParabolicVolumes {
  id: string;
  metrics: ParabolicMetrics;
  /** Raw OHLCV candles spanning L0 through L4/R1, null for cases saved before this was added. */
  candles: ParabolicCandleTuple[] | null;
  createdAt: string;
  updatedAt: string;
}
