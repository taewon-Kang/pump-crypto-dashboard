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

export interface LsEntry {
  id: string;
  symbol: string;
  side: Side;
  entryTime: number;
  entryPrice: number;
  note: string | null;
  createdAt: string;
  metrics: LsMetrics | null;
  error: string | null;
}

export const CHECKPOINT_LABELS: { key: CheckpointKey; label: string }[] = [
  { key: '3d', label: '3일' },
  { key: '7d', label: '7일' },
  { key: '14d', label: '14일' },
  { key: '30d', label: '1달' },
  { key: 'now', label: '현재' },
];
