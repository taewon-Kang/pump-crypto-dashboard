import type { Side, BinancePositionStatus, FillEventType } from '@/generated/prisma/enums';

export interface BinanceFillDto {
  id: string;
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  price: number;
  qty: number;
  quoteQty: number;
  realizedPnl: number;
  commission: number;
  commissionAsset: string;
  isMaker: boolean;
  time: number;
  eventType: FillEventType | null;
}

export interface PostCloseObservationDto {
  checkpoint: '3d' | '7d' | '14d' | '30d';
  observedAt: number;
  price: number;
  returnPct: number;
}

export interface BinancePositionDto {
  id: string;
  symbol: string;
  side: Side;
  status: BinancePositionStatus;
  openedAt: number;
  closedAt: number | null;
  avgEntryPrice: number;
  avgExitPrice: number | null;
  entryQty: number;
  exitQty: number;
  /** Total position size ever entered, in USDT (sum of qty*price across entry fills) — not a coin count. */
  entryNotional: number;
  realizedPnl: number;
  commission: number;
  commissionAsset: string | null;
  leverage: number | null;
  holdingSeconds: number;
  currentPrice: number | null; // live mark price, OPEN positions only
  unrealizedPnl: number | null; // rough estimate from currentPrice, OPEN positions only
  linkedLsEntryId: string | null;
  linkedLsEntry: { id: string; symbol: string; side: Side; entryTime: number } | null;
  fills: BinanceFillDto[];
  observations: PostCloseObservationDto[];
}

export interface BinanceSyncStatus {
  lastRunAt: number | null;
  lastRunStatus: string | null;
  lastError: string | null;
}

export interface BinanceBalanceDto {
  /** Wallet balance only (excludes open positions' unrealized PnL). */
  totalWalletBalance: number;
  /** Unrealized PnL across all open positions, cross and isolated alike. */
  totalUnrealizedProfit: number;
  /** totalWalletBalance + totalUnrealizedProfit — matches Binance app's "총 자산". */
  totalMarginBalance: number;
  availableBalance: number;
}

export interface BinancePositionsResponse {
  positions: BinancePositionDto[];
  sync: BinanceSyncStatus;
  /** Current USDT-M futures account balance summary. Null if the read failed (e.g. API keys not configured). */
  balance: BinanceBalanceDto | null;
}

export interface BinanceSyncSummary {
  skipped: boolean;
  symbolsSynced: number;
  newFills: number;
  positionsTouched: number;
  observationsRecorded: number;
}
