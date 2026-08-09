'use client';
import type { KlineRaw } from '@/types';
import type { Exchange } from '@/types/performance';
import { useFetchJson } from './useFetchJson';

/**
 * Fetches OHLCV candles for a single coin on a given exchange.
 * `symbol` should already be resolved to the exchange's native format
 * (e.g. "BTCUSDT" for Binance, "KRW-BTC" for Upbit).
 */
export function useCoinKlines(symbol: string | null, exchange: Exchange, interval: string) {
  const url = symbol ? `/api/coin-klines?${new URLSearchParams({ exchange, symbol, interval })}` : null;
  return useFetchJson<KlineRaw[]>(url, []);
}
