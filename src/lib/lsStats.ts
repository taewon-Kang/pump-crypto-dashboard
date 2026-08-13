import type { LsEntry, CheckpointKey } from '@/types/ls';

/** The tracker's "now" checkpoint is a moving target, not a fixed horizon — stats only compare the fixed ones. */
export type StatCheckpoint = Exclude<CheckpointKey, 'now'>;

export const STAT_CHECKPOINTS: StatCheckpoint[] = ['3d', '7d', '14d', '30d'];

export const STAT_CHECKPOINT_LABELS: Record<StatCheckpoint, string> = {
  '3d': '3일',
  '7d': '7일',
  '14d': '14일',
  '30d': '1개월',
};

export interface SeriesDef {
  key: string;
  label: string;
  /** Validated against the app's dark card surface (#111827) via the dataviz skill's validate_palette.js. */
  color: string;
  filter: (e: LsEntry) => boolean;
}

// LONG/SHORT reuse the app's existing up/down semantics (see CHART_COLORS),
// stepped one notch darker so the pair clears the dark-mode lightness band.
export const SIDE_SERIES: SeriesDef[] = [
  { key: 'LONG', label: '롱', color: '#059669', filter: (e) => e.side === 'LONG' },
  { key: 'SHORT', label: '숏', color: '#EF4444', filter: (e) => e.side === 'SHORT' },
];

export const REAL_VS_WATCH_SERIES: SeriesDef[] = [
  { key: 'REAL', label: '실제 투자', color: '#3B82F6', filter: (e) => e.isRealTrade },
  { key: 'WATCH', label: '관점용', color: '#D97706', filter: (e) => !e.isRealTrade },
];

export interface SeriesStat {
  key: string;
  label: string;
  color: string;
  /** Sample size — how many entries had this checkpoint elapsed. */
  n: number;
  avg: number | null;
  best: number | null;
  worst: number | null;
}

export interface CheckpointStats {
  checkpoint: StatCheckpoint;
  label: string;
  series: SeriesStat[];
}

function aggregateReturns(entries: LsEntry[], checkpoint: StatCheckpoint) {
  const returns: number[] = [];
  for (const e of entries) {
    const cp = e.metrics?.checkpoints[checkpoint];
    if (cp && cp.elapsed && cp.returnPct !== null) returns.push(cp.returnPct);
  }
  if (!returns.length) return { n: 0, avg: null, best: null, worst: null } as const;
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  return { n: returns.length, avg, best: Math.max(...returns), worst: Math.min(...returns) } as const;
}

/** Builds one row per checkpoint, each holding every series' avg/best/worst return over that horizon. */
export function buildCheckpointStats(entries: LsEntry[], seriesDefs: SeriesDef[]): CheckpointStats[] {
  return STAT_CHECKPOINTS.map((checkpoint) => ({
    checkpoint,
    label: STAT_CHECKPOINT_LABELS[checkpoint],
    series: seriesDefs.map((def) => ({
      key: def.key,
      label: def.label,
      color: def.color,
      ...aggregateReturns(entries.filter(def.filter), checkpoint),
    })),
  }));
}

export interface OverviewStats {
  total: number;
  real: number;
  watch: number;
  /** Share of entries currently (the "now" checkpoint) in profit, null if none have a live metric yet. */
  winRate: number | null;
}

export function computeOverview(entries: LsEntry[]): OverviewStats {
  const total = entries.length;
  const real = entries.filter((e) => e.isRealTrade).length;
  const nowReturns = entries
    .map((e) => e.metrics?.checkpoints.now.returnPct)
    .filter((v): v is number => v !== undefined && v !== null);
  const winRate = nowReturns.length ? (nowReturns.filter((v) => v > 0).length / nowReturns.length) * 100 : null;
  return { total, real, watch: total - real, winRate };
}
