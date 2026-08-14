'use client';
import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import type { LsEntry } from '@/types/ls';
import type { BinancePositionDto, BinancePositionsResponse } from '@/types/binance';
import LoadingDots from '@/components/LoadingDots';
import CheckpointBarChart from '@/components/stats/CheckpointBarChart';
import CheckpointStatsTable from '@/components/stats/CheckpointStatsTable';
import BinanceEquityChart from '@/components/BinanceEquityChart';
import { buildCheckpointStats, computeOverview, SIDE_SERIES, REAL_VS_WATCH_SERIES } from '@/lib/lsStats';
import { computeBinanceOverview, buildSymbolBreakdown, buildSideBreakdown, buildEquityCurve } from '@/lib/binanceStats';

function Signed({ v, unit = '', className = '' }: { v: number; unit?: string; className?: string }) {
  const positive = v >= 0;
  return (
    <span className={`font-mono tabular-nums ${positive ? 'text-emerald-400' : 'text-red-400'} ${className}`}>
      {positive ? '+' : ''}
      {v.toFixed(2)}
      {unit}
    </span>
  );
}

type Metric = 'avg' | 'best' | 'worst';

const METRIC_TABS: { key: Metric; label: string }[] = [
  { key: 'avg', label: '평균 수익률' },
  { key: 'best', label: '최고 수익' },
  { key: 'worst', label: '최저 수익(최고손해)' },
];

function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
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
  const [positions, setPositions] = useState<BinancePositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('avg');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lsRes, posRes] = await Promise.all([fetch('/api/ls'), fetch('/api/binance/positions')]);
      if (!lsRes.ok) throw new Error(`HTTP ${lsRes.status}`);
      const data: LsEntry[] = await lsRes.json();
      setEntries(data);
      if (posRes.ok) {
        const posData: BinancePositionsResponse = await posRes.json();
        setPositions(posData.positions);
      }
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

  const binanceOverview = useMemo(() => computeBinanceOverview(positions), [positions]);
  const symbolBreakdown = useMemo(() => buildSymbolBreakdown(positions), [positions]);
  const sideBreakdown = useMemo(() => buildSideBreakdown(positions), [positions]);
  const equityCurve = useMemo(() => buildEquityCurve(positions), [positions]);

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
      ) : (
        <>
          {entries.length === 0 ? (
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

          {/* Binance 실거래 성과 — separate data source (BinancePosition), independent of L/S Tracker entries above */}
          <section className="bg-[#111827] rounded-xl border border-[#1F2937] p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-200">실거래 성과 (바이낸스 연동)</h2>
              <p className="text-[11px] text-gray-600 mt-0.5">
                동기화된 실제 체결 기준. 수수료를 뺀 순손익(realizedPnl − commission)으로 집계합니다.
              </p>
            </div>

            {positions.length === 0 ? (
              <div className="px-2 py-8 text-center text-gray-600 text-sm">
                아직 동기화된 실거래 내역이 없습니다.{' '}
                <Link href="/longshort/real-trades" className="text-blue-400 hover:underline">
                  실거래 내역 페이지
                </Link>
                에서 동기화해주세요.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <StatTile
                    label="순손익"
                    value={
                      <Signed v={binanceOverview.netPnl} unit=" USDT" className="text-xl font-semibold" />
                    }
                  />
                  <StatTile
                    label="승률 (종료 기준)"
                    value={binanceOverview.winRate === null ? '–' : `${binanceOverview.winRate.toFixed(0)}%`}
                    sub={`종료 ${binanceOverview.closedPositions}건 · 진행중 ${binanceOverview.openPositions}건`}
                  />
                  <StatTile
                    label="손익비 (Profit Factor)"
                    value={binanceOverview.profitFactor === null ? '–' : binanceOverview.profitFactor.toFixed(2)}
                    sub="총이익 ÷ 총손실"
                  />
                  <StatTile
                    label="평균 보유시간"
                    value={binanceOverview.avgHoldingHours === null ? '–' : `${binanceOverview.avgHoldingHours.toFixed(1)}시간`}
                    sub={binanceOverview.avgLeverage !== null ? `평균 ${binanceOverview.avgLeverage.toFixed(1)}x` : undefined}
                  />
                </div>

                {equityCurve.length >= 2 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 mb-1.5">누적 손익 추이</h3>
                    <BinanceEquityChart data={equityCurve} />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 mb-1.5">롱 vs 숏</h3>
                    <table className="w-full text-xs text-gray-400">
                      <thead>
                        <tr className="text-gray-600 text-left border-b border-[#1F2937]">
                          <th className="py-1 font-normal">방향</th>
                          <th className="py-1 font-normal text-right">건수</th>
                          <th className="py-1 font-normal text-right">승률</th>
                          <th className="py-1 font-normal text-right">순손익</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sideBreakdown.map((row) => (
                          <tr key={row.side} className="border-b border-[#1F2937]/60">
                            <td className="py-1.5">
                              <span className={row.side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}>{row.side}</span>
                            </td>
                            <td className="py-1.5 text-right font-mono">{row.trades}</td>
                            <td className="py-1.5 text-right font-mono">{row.winRate === null ? '–' : `${row.winRate.toFixed(0)}%`}</td>
                            <td className="py-1.5 text-right">
                              <Signed v={row.netPnl} unit=" USDT" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 mb-1.5">심볼별 순손익</h3>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs text-gray-400">
                        <thead>
                          <tr className="text-gray-600 text-left border-b border-[#1F2937] sticky top-0 bg-[#111827]">
                            <th className="py-1 font-normal">심볼</th>
                            <th className="py-1 font-normal text-right">건수</th>
                            <th className="py-1 font-normal text-right">승률</th>
                            <th className="py-1 font-normal text-right">순손익</th>
                          </tr>
                        </thead>
                        <tbody>
                          {symbolBreakdown.map((row) => (
                            <tr key={row.symbol} className="border-b border-[#1F2937]/60">
                              <td className="py-1.5">{row.symbol.replace('USDT', '')}</td>
                              <td className="py-1.5 text-right font-mono">{row.trades}</td>
                              <td className="py-1.5 text-right font-mono">{row.winRate.toFixed(0)}%</td>
                              <td className="py-1.5 text-right">
                                <Signed v={row.netPnl} unit=" USDT" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
