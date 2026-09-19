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

export interface ParabolicPoint {
  time: number; // epoch ms
  price: number;
}

export type ParabolicPoints = Record<RequiredPointKey, ParabolicPoint> & { l4: ParabolicPoint | null };

export const TIMEFRAME_OPTIONS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'] as const;
export type Timeframe = (typeof TIMEFRAME_OPTIONS)[number];

export interface LegMetric {
  /** Signed % price change over the leg (rise legs positive, drop legs negative). */
  pct: number;
  durationHours: number;
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
  /** Overall pump size, L0 -> H3. */
  totalRisePct: number;
  /** L0 -> R1 (or L0 -> L4 when a next drop low is set). */
  totalDurationHours: number;
  /** % of the L0->H1 gain given back by the L1 pullback. */
  retrace1Pct: number;
  /** % of the L1->H2 gain given back by the L2 pullback. */
  retrace2Pct: number;
  /** % of the H3->L3 drop the R1 rebound recovered. */
  reboundRetracePct: number;
  /** Higher-low checks vs. the prior structural low. */
  l1VsL0Pct: number;
  l2VsL1Pct: number;
  l3VsL0Pct: number;
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

export interface ParabolicCaseInput {
  symbol: string;
  timeframe: string;
  points: ParabolicPoints;
  finalTopYn: boolean | null;
  notes: string | null;
}

export interface ParabolicCase extends ParabolicCaseInput, ParabolicVolumes {
  id: string;
  metrics: ParabolicMetrics;
  createdAt: string;
  updatedAt: string;
}
