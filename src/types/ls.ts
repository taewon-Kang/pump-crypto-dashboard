export type Side = 'LONG' | 'SHORT';

export type CheckpointKey = '3d' | '7d' | '14d' | '30d' | 'now';

export interface CheckpointMetric {
  elapsed: boolean;
  atTime: number;
  returnPct: number | null;
  bestPct: number;
  worstPct: number;
}

export interface LsMetrics {
  currentPrice: number;
  checkpoints: Record<CheckpointKey, CheckpointMetric>;
}

export type PumpPhase =
  | 'SECOND_LEG_START'
  | 'THIRD_LEG_START'
  | 'ADDITIONAL_RISE'
  | 'TOP_EXPECTED'
  | 'TOP_REBOUND_THEN_DROP'
  | 'REBOUND_THEN_DROP'
  | 'OTHER';

export const PUMP_PHASE_LABELS: { key: PumpPhase; label: string }[] = [
  { key: 'SECOND_LEG_START', label: '2차 시작' },
  { key: 'THIRD_LEG_START', label: '3차 시작' },
  { key: 'ADDITIONAL_RISE', label: '추가 상승' },
  { key: 'TOP_EXPECTED', label: '고점 예상' },
  { key: 'TOP_REBOUND_THEN_DROP', label: '고점 반등 이후 하락' },
  { key: 'REBOUND_THEN_DROP', label: '반등 이후 하락' },
  { key: 'OTHER', label: '기타' },
];

export function pumpPhaseLabel(key: PumpPhase | null | undefined): string | null {
  if (!key) return null;
  return PUMP_PHASE_LABELS.find((p) => p.key === key)?.label ?? key;
}

export interface LsEntry {
  id: string;
  symbol: string;
  side: Side;
  entryTime: number;
  entryPrice: number;
  /** BTCUSDT futures price snapshotted at entryTime, for benchmarking against BTC's own move. */
  btcPriceAtEntry: number | null;
  pumpPhase: PumpPhase | null;
  note: string | null;
  /** Set once tracking for this entry has been ended — metrics freeze as of this time. */
  endedAt: number | null;
  createdAt: string;
  metrics: LsMetrics | null;
  /** BTC's own checkpoint metrics over the same window, from btcPriceAtEntry. Null until backfilled. */
  btcMetrics: LsMetrics | null;
  error: string | null;
}

export const CHECKPOINT_LABELS: { key: CheckpointKey; label: string }[] = [
  { key: '3d', label: '3일' },
  { key: '7d', label: '7일' },
  { key: '14d', label: '14일' },
  { key: '30d', label: '1달' },
  { key: 'now', label: '현재' },
];
