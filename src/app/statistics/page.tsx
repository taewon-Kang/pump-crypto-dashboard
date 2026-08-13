'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { LsEntry } from '@/types/ls';
import LoadingDots from '@/components/LoadingDots';
import CheckpointBarChart from '@/components/stats/CheckpointBarChart';
import CheckpointStatsTable from '@/components/stats/CheckpointStatsTable';
import { buildCheckpointStats, computeOverview, SIDE_SERIES, REAL_VS_WATCH_SERIES } from '@/lib/lsStats';

type Metric = 'avg' | 'best' | 'worst';

const METRIC_TABS: { key: Metric; label: string }[] = [
  { key: 'avg', label: '평균 수익률' },
  { key: 'best', label: '최고 수익' },
  { key: 'worst', label: '최저 수익(최고손해)' },
];

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-3 flex flex-col gap-1">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className="text-xl font-semibold text-gray-100">{value}</span>
      {sub && <span className="text-[11px] text-gray-600">{sub}</span>}
    </div>
  );
}

export default function StatisticsPage() {
  const [entries, setEntries] = useState<LsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('avg');

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const overview = useMemo(() => computeOverview(entries), [entries]);
  const sideStats = useMemo(() => buildCheckpointStats(entries, SIDE_SERIES), [entries]);
  const realStats = useMemo(() => buildCheckpointStats(entries, REAL_VS_WATCH_SERIES), [entries]);

  return (
    <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-3 sm:py-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-100">통계</h1>
        <p className="text-xs text-gray-600 mt-0.5">
          L/S Tracker에 기록된 모든 콜을 기준으로, 3일·7일·14일·1개월 시점의 롱/숏 성과와 실제 투자 vs 관점용 성과를 비교합니다.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">⚠ {error}</div>
      )}

      {loading ? (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-8 text-center space-y-2">
          <div className="flex justify-center">
            <LoadingDots />
          </div>
          <p className="text-sm text-gray-500">데이터를 불러오는 중입니다...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-12 text-center text-gray-600 text-sm">
          L/S Tracker에 기록이 없습니다. 먼저 기록을 남겨주세요.
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatTile label="전체 기록" value={`${overview.total}건`} />
            <StatTile label="실제 투자" value={`${overview.real}건`} />
            <StatTile label="관점용" value={`${overview.watch}건`} />
            <StatTile
              label="현재 시점 승률"
              value={overview.winRate === null ? '–' : `${overview.winRate.toFixed(0)}%`}
              sub="now 체크포인트 기준"
            />
          </div>

          {/* Metric tabs — shared by both charts below */}
          <div className="flex gap-1 bg-[#111827] border border-[#1F2937] rounded-lg p-1 w-fit">
            {METRIC_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  metric === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Long vs Short */}
          <section className="bg-[#111827] rounded-xl border border-[#1F2937] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-200">롱 vs 숏</h2>
            <CheckpointBarChart data={sideStats} seriesDefs={SIDE_SERIES} metric={metric} />
            <details className="group">
              <summary className="text-[11px] text-gray-500 cursor-pointer select-none hover:text-gray-300 transition-colors">
                표로 보기
              </summary>
              <div className="pt-2">
                <CheckpointStatsTable data={sideStats} />
              </div>
            </details>
          </section>

          {/* Real trade vs watch-only */}
          <section className="bg-[#111827] rounded-xl border border-[#1F2937] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-200">실제 투자 vs 관점용</h2>
            <CheckpointBarChart data={realStats} seriesDefs={REAL_VS_WATCH_SERIES} metric={metric} />
            <details className="group">
              <summary className="text-[11px] text-gray-500 cursor-pointer select-none hover:text-gray-300 transition-colors">
                표로 보기
              </summary>
              <div className="pt-2">
                <CheckpointStatsTable data={realStats} />
              </div>
            </details>
          </section>
        </>
      )}
    </main>
  );
}
