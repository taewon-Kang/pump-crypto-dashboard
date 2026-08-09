'use client';
import { useState, useEffect } from 'react';
import type { KlineRaw } from '@/types';
import type { Exchange } from '@/types/performance';

/**
 * Fetches OHLCV candles for a single coin on a given exchange.
 * `symbol` should already be resolved to the exchange's native format
 * (e.g. "BTCUSDT" for Binance, "KRW-BTC" for Upbit).
 */
export function useCoinKlines(symbol: string | null, exchange: Exchange, interval: string) {
  const [data, setData] = useState<KlineRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) {
      setData([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ exchange, symbol, interval });

    fetch(`/api/coin-klines?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '알 수 없는 오류');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, exchange, interval]);

  return { data, loading, error };
}
