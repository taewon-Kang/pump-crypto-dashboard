'use client';
import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { BinanceBalanceDto, BinancePositionDto, BinancePositionsResponse, BinanceSyncSummary } from '@/types/binance';
import type { LsEntry } from '@/types/ls';
import LoadingDots from '@/components/LoadingDots';
import BinancePositionCard from '@/components/BinancePositionCard';

type StatusFilter = 'all' | 'open' | 'closed';

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

export default function RealTradesPage() {
  const [positions, setPositions] = useState<BinancePositionDto[]>([]);
  const [lsOptions, setLsOptions] = useState<LsEntry[]>([]);
  const [syncStatus, setSyncStatus] = useState<BinancePositionsResponse['sync'] | null>(null);
  const [balance, setBalance] = useState<BinanceBalanceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [posRes, lsRes] = await Promise.all([fetch('/api/binance/positions'), fetch('/api/ls')]);
      if (!posRes.ok) throw new Error(`HTTP ${posRes.status}`);
      const posData: BinancePositionsResponse = await posRes.json();
      setPositions(posData.positions);
      setSyncStatus(posData.sync);
      setBalance(posData.balance);
      if (lsRes.ok) setLsOptions(await lsRes.json());
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

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/binance/sync', { method: 'POST' });
      const summary: BinanceSyncSummary | { error: string } = await res.json();
      if (!res.ok || 'error' in summary) {
        throw new Error('error' in summary ? summary.error : `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleLink(positionId: string, lsEntryId: string | null) {
    const res = await fetch(`/api/binance/positions/${positionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedLsEntryId: lsEntryId }),
    });
    if (!res.ok) {
      setError('연결에 실패했습니다.');
      return;
    }
    await load();
  }

  const visible = useMemo(
    () =>
      positions.filter((p) => {
        if (statusFilter === 'open' && p.status !== 'OPEN') return false;
        if (statusFilter === 'closed' && p.status !== 'CLOSED') return false;
        return true;
      }),
    [positions, statusFilter]
  );

  const openCount = positions.filter((p) => p.status === 'OPEN').length;
  const closedCount = positions.length - openCount;
  const totalRealizedPnl = positions.reduce((s, p) => s + p.realizedPnl, 0);
  const closedWithResult = positions.filter((p) => p.status === 'CLOSED');
  const winCount = closedWithResult.filter((p) => p.realizedPnl > 0).length;
  const winRate = closedWithResult.length ? (winCount / closedWithResult.length) * 100 : null;

  return (
    <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-3 sm:py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">실거래 내역</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            바이낸스 선물 계정의 실제 체결 내역을 읽어와 포지션 단위로 자동 정리합니다. 조회 전용이며, 이
            페이지에서 매수/매도 등 실제 거래는 발생하지 않습니다.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                       disabled:cursor-not-allowed text-white transition-colors"
          >
            {syncing ? '동기화 중...' : '지금 동기화'}
          </button>
          {syncStatus?.lastRunAt && (
            <span className="text-[11px] text-gray-600">
              마지막 동기화: {new Date(syncStatus.lastRunAt).toLocaleString('ko-KR')}
              {syncStatus.lastRunStatus === 'error' && <span className="text-red-400"> (오류)</span>}
            </span>
          )}
        </div>
      </div>

      {balance && (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-gray-500">USDT 총 자산 (지갑잔고 + 미실현 손익, 바이낸스 앱 오버뷰와 동일 기준)</span>
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold font-mono tabular-nums text-gray-100">
              {balance.totalMarginBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
            </span>
            <span className="text-xs text-gray-500 font-mono tabular-nums">
              지갑 {balance.totalWalletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-gray-500">
              미실현 <Signed v={balance.totalUnrealizedProfit} className="text-xs" />
            </span>
            <span className="text-xs text-gray-500 font-mono tabular-nums">
              가용 {balance.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">⚠ {error}</div>
      )}
      {syncStatus?.lastError && (
        <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl px-4 py-3 text-amber-400 text-xs">
          마지막 동기화 오류: {syncStatus.lastError}
        </div>
      )}

      {loading ? (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-8 text-center space-y-2">
          <div className="flex justify-center">
            <LoadingDots />
          </div>
          <p className="text-sm text-gray-500">불러오는 중입니다...</p>
        </div>
      ) : positions.length === 0 ? (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-12 text-center text-gray-600 text-sm space-y-2">
          <p>아직 동기화된 실거래 내역이 없습니다.</p>
          <p className="text-xs text-gray-700">
            .env.local에 BINANCE_API_KEY / BINANCE_SECRET_KEY(읽기 전용 권한)를 설정한 뒤 &ldquo;지금 동기화&rdquo;를
            눌러주세요.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryStat label="진행중" value={String(openCount)} />
            <SummaryStat label="종료됨" value={String(closedCount)} />
            <SummaryStat label="총 실현손익" value={<Signed v={totalRealizedPnl} unit=" USDT" className="text-base font-bold" />} />
            <SummaryStat label="승률 (종료 기준)" value={winRate !== null ? `${winRate.toFixed(1)}%` : '—'} />
          </div>

          <div className="flex gap-1 bg-[#111827] border border-[#1F2937] rounded-lg p-1 w-fit">
            {(
              [
                { key: 'all', label: `전체 (${positions.length})` },
                { key: 'open', label: `진행중 (${openCount})` },
                { key: 'closed', label: `종료됨 (${closedCount})` },
              ] as { key: StatusFilter; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {visible.map((p) => (
              <BinancePositionCard key={p.id} position={p} lsOptions={lsOptions} onLink={handleLink} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function SummaryStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-3 py-2.5 flex flex-col gap-1">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-gray-200">{value}</span>
    </div>
  );
}
