import type { BinancePositionDto } from '@/types/binance';

/** Net of realized PnL and commission — every stat below uses this, not raw realizedPnl. */
function netPnl(p: BinancePositionDto): number {
  return p.realizedPnl - p.commission;
}

export interface BinanceOverviewStats {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalRealizedPnl: number;
  totalCommission: number;
  netPnl: number;
  /** Share of closed positions with net-positive PnL. Null if nothing has closed yet. */
  winRate: number | null;
  /** Gross profit / gross loss among closed positions. Null with no losses to divide by. */
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  avgHoldingHours: number | null;
  avgLeverage: number | null;
}

export function computeBinanceOverview(positions: BinancePositionDto[]): BinanceOverviewStats {
  const closed = positions.filter((p) => p.status === 'CLOSED');
  const wins = closed.filter((p) => netPnl(p) > 0);
  const losses = closed.filter((p) => netPnl(p) < 0);
  const grossProfit = wins.reduce((s, p) => s + netPnl(p), 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + netPnl(p), 0));
  const leverages = positions.map((p) => p.leverage).filter((v): v is number => v !== null);

  return {
    totalPositions: positions.length,
    openPositions: positions.length - closed.length,
    closedPositions: closed.length,
    totalRealizedPnl: positions.reduce((s, p) => s + p.realizedPnl, 0),
    totalCommission: positions.reduce((s, p) => s + p.commission, 0),
    netPnl: positions.reduce((s, p) => s + netPnl(p), 0),
    winRate: closed.length ? (wins.length / closed.length) * 100 : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    avgWin: wins.length ? grossProfit / wins.length : null,
    avgLoss: losses.length ? -grossLoss / losses.length : null,
    avgHoldingHours: closed.length ? closed.reduce((s, p) => s + p.holdingSeconds, 0) / closed.length / 3600 : null,
    avgLeverage: leverages.length ? leverages.reduce((a, b) => a + b, 0) / leverages.length : null,
  };
}

export interface SymbolBreakdownRow {
  symbol: string;
  trades: number;
  winRate: number;
  netPnl: number;
}

/** One row per symbol with at least one closed position, sorted by net PnL descending. */
export function buildSymbolBreakdown(positions: BinancePositionDto[]): SymbolBreakdownRow[] {
  const closed = positions.filter((p) => p.status === 'CLOSED');
  const bySymbol = new Map<string, BinancePositionDto[]>();
  for (const p of closed) {
    if (!bySymbol.has(p.symbol)) bySymbol.set(p.symbol, []);
    bySymbol.get(p.symbol)!.push(p);
  }
  return [...bySymbol.entries()]
    .map(([symbol, rows]) => ({
      symbol,
      trades: rows.length,
      winRate: (rows.filter((r) => netPnl(r) > 0).length / rows.length) * 100,
      netPnl: rows.reduce((s, r) => s + netPnl(r), 0),
    }))
    .sort((a, b) => b.netPnl - a.netPnl);
}

export interface SideBreakdownRow {
  side: 'LONG' | 'SHORT';
  trades: number;
  winRate: number | null;
  netPnl: number;
  avgPnl: number | null;
}

export function buildSideBreakdown(positions: BinancePositionDto[]): SideBreakdownRow[] {
  const closed = positions.filter((p) => p.status === 'CLOSED');
  return (['LONG', 'SHORT'] as const).map((side) => {
    const rows = closed.filter((p) => p.side === side);
    const total = rows.reduce((s, r) => s + netPnl(r), 0);
    return {
      side,
      trades: rows.length,
      winRate: rows.length ? (rows.filter((r) => netPnl(r) > 0).length / rows.length) * 100 : null,
      netPnl: total,
      avgPnl: rows.length ? total / rows.length : null,
    };
  });
}

export interface EquityPoint {
  /** Unix seconds. */
  time: number;
  cumulativePnl: number;
}

/** Cumulative net PnL over time, one point per unique close timestamp (positions closing at the same second are merged). */
export function buildEquityCurve(positions: BinancePositionDto[]): EquityPoint[] {
  const closed = positions
    .filter((p): p is BinancePositionDto & { closedAt: number } => p.status === 'CLOSED' && p.closedAt !== null)
    .sort((a, b) => a.closedAt - b.closedAt);

  let cum = 0;
  const byTime = new Map<number, number>();
  for (const p of closed) {
    cum += netPnl(p);
    byTime.set(Math.floor(p.closedAt / 1000), cum);
  }
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([time, cumulativePnl]) => ({ time, cumulativePnl }));
}
