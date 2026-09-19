import { createHmac } from 'node:crypto';

/**
 * Signed, read-only client for the user's own Binance USDT-M Futures
 * account. This file intentionally implements ONLY GET endpoints that read
 * account history — it must never grow an order-placing/cancelling call.
 * The API key configured in BINANCE_API_KEY should be created on Binance
 * with "Enable Reading" only (no "Enable Futures"/trading, no withdrawals).
 */

const FUTURES_BASE = 'https://fapi.binance.com';

function requireCreds(): { apiKey: string; secretKey: string } {
  const apiKey = process.env.BINANCE_API_KEY;
  const secretKey = process.env.BINANCE_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error('BINANCE_API_KEY / BINANCE_SECRET_KEY가 설정되어 있지 않습니다.');
  }
  return { apiKey, secretKey };
}

function sign(query: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(query).digest('hex');
}

// Binance rejects a signed request outright if its timestamp is even ~1s
// ahead of the exchange's own clock (recvWindow only forgives being behind,
// not ahead) — so local clock drift alone can break every signed call.
// Cache the offset from a cheap public/unsigned endpoint and reuse it.
let serverTimeOffsetMs: number | null = null;
let serverTimeOffsetFetchedAt = 0;
const SERVER_TIME_TTL_MS = 5 * 60_000;

async function getServerTimeOffset(): Promise<number> {
  const now = Date.now();
  if (serverTimeOffsetMs !== null && now - serverTimeOffsetFetchedAt < SERVER_TIME_TTL_MS) {
    return serverTimeOffsetMs;
  }
  try {
    const res = await fetch(`${FUTURES_BASE}/fapi/v1/time`, { cache: 'no-store' });
    const { serverTime } = (await res.json()) as { serverTime: number };
    serverTimeOffsetMs = serverTime - Date.now();
    serverTimeOffsetFetchedAt = now;
  } catch {
    serverTimeOffsetMs = serverTimeOffsetMs ?? 0;
  }
  return serverTimeOffsetMs;
}

/** Signed GET against the futures API. `params` values are stringified as-is. */
async function signedGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const { apiKey, secretKey } = requireCreds();
  const offset = await getServerTimeOffset();

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) query.set(k, String(v));
  }
  query.set('timestamp', String(Date.now() + offset));
  query.set('recvWindow', '10000');

  const qs = query.toString();
  const signature = sign(qs, secretKey);
  const url = `${FUTURES_BASE}${path}?${qs}&signature=${signature}`;

  const res = await fetch(url, {
    headers: { 'X-MBX-APIKEY': apiKey },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Binance API error ${res.status} on ${path}: ${body}`);
  }
  return (await res.json()) as T;
}

export interface BinanceIncomeRow {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
  tranId: number;
}

/** GET /fapi/v1/income — used only to discover which symbols had account activity in a window. */
export async function fetchIncomeHistory(params: {
  startTime: number;
  endTime: number;
  limit?: number;
}): Promise<BinanceIncomeRow[]> {
  return signedGet<BinanceIncomeRow[]>('/fapi/v1/income', {
    startTime: params.startTime,
    endTime: params.endTime,
    limit: params.limit ?? 1000,
  });
}

export interface BinanceUserTrade {
  symbol: string;
  id: number; // Binance's own per-symbol trade id
  orderId: number;
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  price: string;
  qty: string;
  quoteQty: string;
  realizedPnl: string;
  commission: string;
  commissionAsset: string;
  maker: boolean;
  time: number;
}

/** GET /fapi/v1/userTrades scoped by [startTime, endTime] — max 7-day window per Binance's own limit. */
export async function fetchUserTradesByTime(
  symbol: string,
  startTime: number,
  endTime: number,
  limit = 1000
): Promise<BinanceUserTrade[]> {
  return signedGet<BinanceUserTrade[]>('/fapi/v1/userTrades', { symbol, startTime, endTime, limit });
}

/** GET /fapi/v1/userTrades scoped by fromId — unbounded time range, used for incremental catch-up sync. */
export async function fetchUserTradesFromId(symbol: string, fromId: number, limit = 1000): Promise<BinanceUserTrade[]> {
  return signedGet<BinanceUserTrade[]>('/fapi/v1/userTrades', { symbol, fromId, limit });
}

/** GET /fapi/v1/positionSide/dual — whether the account is in hedge mode (independent LONG/SHORT) or one-way mode. */
export async function fetchPositionMode(): Promise<boolean> {
  const res = await signedGet<{ dualSidePosition: boolean }>('/fapi/v1/positionSide/dual');
  return res.dualSidePosition;
}

export interface BinanceBalanceRow {
  asset: string;
  balance: number;
  availableBalance: number;
  crossUnPnl: number;
}

/** GET /fapi/v2/balance — wallet balance per asset on the USDT-M futures account. */
export async function fetchFuturesBalances(): Promise<BinanceBalanceRow[]> {
  const res = await signedGet<
    { asset: string; balance: string; availableBalance: string; crossUnPnl: string }[]
  >('/fapi/v2/balance');
  return res.map((r) => ({
    asset: r.asset,
    balance: parseFloat(r.balance),
    availableBalance: parseFloat(r.availableBalance),
    crossUnPnl: parseFloat(r.crossUnPnl),
  }));
}

/** Convenience wrapper: just the USDT row, since the account only trades USDT-M pairs. */
export async function fetchUsdtBalance(): Promise<BinanceBalanceRow | null> {
  const rows = await fetchFuturesBalances();
  return rows.find((r) => r.asset === 'USDT') ?? null;
}

export interface BinanceAccountSummary {
  /** Wallet balance only — deposits/withdrawals/realized PnL, excludes open positions' unrealized PnL. */
  totalWalletBalance: number;
  /** Unrealized PnL across every open position, cross AND isolated margin alike. */
  totalUnrealizedProfit: number;
  /** totalWalletBalance + totalUnrealizedProfit — this is the number Binance's app shows as account/futures "total". */
  totalMarginBalance: number;
  availableBalance: number;
}

/**
 * GET /fapi/v2/account — account-wide totals in USDT.
 *
 * /fapi/v2/balance's per-asset `balance` only reflects wallet balance; for
 * ISOLATED-margin positions their unrealized PnL never lands in `balance` or
 * `crossUnPnl`, so summing balances alone undercounts the account by however
 * much is unrealized on open isolated positions. This endpoint's
 * totalMarginBalance already folds in unrealized PnL from both cross and
 * isolated positions, matching the "총 자산" figure shown in Binance's app.
 */
export async function fetchFuturesAccountSummary(): Promise<BinanceAccountSummary> {
  const res = await signedGet<{
    totalWalletBalance: string;
    totalUnrealizedProfit: string;
    totalMarginBalance: string;
    availableBalance: string;
  }>('/fapi/v2/account');
  return {
    totalWalletBalance: parseFloat(res.totalWalletBalance),
    totalUnrealizedProfit: parseFloat(res.totalUnrealizedProfit),
    totalMarginBalance: parseFloat(res.totalMarginBalance),
    availableBalance: parseFloat(res.availableBalance),
  };
}

/** GET /fapi/v2/positionRisk — best-effort current leverage setting for a symbol. */
export async function fetchSymbolLeverage(symbol: string): Promise<number | null> {
  try {
    const res = await signedGet<{ leverage: string }[]>('/fapi/v2/positionRisk', { symbol });
    const lev = res[0]?.leverage;
    return lev !== undefined ? parseInt(lev, 10) : null;
  } catch {
    return null;
  }
}
