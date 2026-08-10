'use client';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 4000;

/**
 * Short-polls `/api/ls/prices` for `symbols` on a fixed interval — the
 * "실시간" price source for L/S Tracker cards. REST instead of a raw
 * Binance WebSocket: fstream.binance.com's WS data plane is silently
 * dropped on some networks (handshake succeeds, zero frames ever arrive)
 * even though the same host's REST API stays reachable.
 */
export function useLivePrices(
  symbols: string[]
): { prices: Record<string, number>; active: boolean; lastUpdatedAt: number | null } {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [active, setActive] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Stable key so the effect only re-runs when the *set* of symbols changes.
  const key = [...new Set(symbols)].filter(Boolean).sort().join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch(`/api/ls/prices?symbols=${key}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Record<string, number> = await res.json();
        if (!cancelled) {
          setPrices(data);
          setActive(true);
          setLastUpdatedAt(Date.now());
        }
      } catch {
        if (!cancelled) setActive(false);
      } finally {
        // Chained via setTimeout (not setInterval) so a slow/failed request
        // can't stack overlapping polls.
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [key]);

  if (!key) return { prices: {}, active: false, lastUpdatedAt: null };
  return { prices, active, lastUpdatedAt };
}
