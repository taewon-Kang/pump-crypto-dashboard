'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { LsEntry, Side } from '@/types/ls';
import LsEntryForm from '@/components/LsEntryForm';
import LsEntryCard from '@/components/LsEntryCard';
import LoadingDots from '@/components/LoadingDots';
import { useLivePrices } from '@/hooks/useLivePrices';
import { applyLivePrice } from '@/lib/lsReturns';

export default function LongShortTrackerPage() {
  const [entries, setEntries] = useState<LsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const symbols = useMemo(() => entries.map((e) => e.symbol), [entries]);
  const { prices: livePrices, active: liveActive, lastUpdatedAt } = useLivePrices(symbols);

  // Ticks once/sec purely to refresh the "N초 전" label below — cheap,
  // scoped to only run while there's something to poll for.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!entries.length) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [entries.length]);

  // Overlay the latest polled price onto the last REST-computed metrics so
  // the "현재" checkpoint updates every poll without re-hitting the full API.
  const liveEntries = useMemo(
    () =>
      entries.map((entry) => {
        const livePrice = livePrices[entry.symbol];
        if (!entry.metrics || livePrice === undefined) return entry;
        return { ...entry, metrics: applyLivePrice(entry.metrics, entry.side, entry.entryPrice, livePrice) };
      }),
    [entries, livePrices]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ls');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LsEntry[] = await res.json();
      setEntries(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount idiom — `load` itself owns the loading/error state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreate(data: { symbol: string; side: Side; entryTime: number; note: string }) {
    const res = await fetch('/api/ls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    await load();
  }

  async function handleDelete(id: string) {
    const prev = entries;
    setEntries((cur) => cur.filter((e) => e.id !== id));
    const res = await fetch(`/api/ls/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setEntries(prev); // roll back on failure
      setError('삭제에 실패했습니다.');
    }
  }

  return (
    <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-3 sm:py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">L/S Tracker</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            바이낸스 선물 기준 롱/숏 관점을 기록하고, 3일·7일·14일·1달·현재 시점 수익률과
            구간 내 최고/최저 수익률을 추적합니다.
          </p>
        </div>
        {entries.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5 text-[11px] text-gray-500">
            <span
              className={`w-1.5 h-1.5 rounded-full ${liveActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`}
            />
            {liveActive && lastUpdatedAt
              ? `실시간(4초 주기) · 마지막 갱신 ${Math.max(0, Math.round((nowTick - lastUpdatedAt) / 1000))}초 전`
              : '연결 중...'}
          </div>
        )}
      </div>

      <LsEntryForm onSubmit={handleCreate} />

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-8 text-center space-y-2">
          <div className="flex justify-center">
            <LoadingDots />
          </div>
          <p className="text-sm text-gray-500">기록을 불러오는 중입니다...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-12 text-center text-gray-600 text-sm">
          아직 기록이 없습니다. 위에서 첫 롱/숏 관점을 기록해보세요.
        </div>
      ) : (
        <div className="space-y-2.5">
          {liveEntries.map((entry) => (
            <LsEntryCard
              key={entry.id}
              entry={entry}
              onDelete={handleDelete}
              live={livePrices[entry.symbol] !== undefined}
            />
          ))}
        </div>
      )}
    </main>
  );
}
