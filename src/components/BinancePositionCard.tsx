'use client';
import { useState, type ReactNode } from 'react';
import type { BinancePositionDto } from '@/types/binance';
import type { LsEntry } from '@/types/ls';
import { formatPrice } from '@/lib/format';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}일 ${h}시간`;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

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

const EVENT_LABELS: Record<string, string> = {
  ENTRY: '진입',
  ADD: '추가진입',
  PARTIAL_TP: '부분청산',
  CLOSE: '전체청산',
};

const EVENT_COLORS: Record<string, string> = {
  ENTRY: 'bg-blue-900/40 text-blue-400',
  ADD: 'bg-indigo-900/40 text-indigo-400',
  PARTIAL_TP: 'bg-amber-900/40 text-amber-400',
  CLOSE: 'bg-gray-700/60 text-gray-300',
};

const CHECKPOINT_LABELS: Record<string, string> = { '3d': '3일 후', '7d': '7일 후', '14d': '14일 후', '30d': '1달 후' };

interface Props {
  position: BinancePositionDto;
  lsOptions: LsEntry[]; // candidate manual entries to link (same symbol, real trades)
  onLink: (positionId: string, lsEntryId: string | null) => Promise<void>;
}

export default function BinancePositionCard({ position: p, lsOptions, onLink }: Props) {
  const [fillsOpen, setFillsOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const isLong = p.side === 'LONG';
  const isOpen = p.status === 'OPEN';

  const candidates = lsOptions.filter((e) => e.symbol === p.symbol && e.isRealTrade);

  async function handleLinkChange(value: string) {
    setLinking(true);
    try {
      await onLink(p.id, value === '' ? null : value);
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className={`bg-[#111827] rounded-xl border overflow-hidden ${isOpen ? 'border-[#1F2937]' : 'border-[#1F2937]/60'}`}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#1F2937] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              isLong ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
            }`}
          >
            {isLong ? 'LONG' : 'SHORT'}
          </span>
          <span className="font-semibold text-gray-100 truncate">
            {p.symbol.replace('USDT', '')}
            <span className="text-gray-600">/USDT</span>
          </span>
          {p.leverage && <span className="text-[11px] text-gray-500 font-mono shrink-0">{p.leverage}x</span>}
          <span className="text-xs text-gray-600 shrink-0 hidden md:inline">{formatTime(p.openedAt)}</span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              isOpen ? 'text-blue-400 bg-blue-900/30' : 'text-gray-500 bg-[#1F2937]'
            }`}
          >
            {isOpen ? '진행중' : '종료됨'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isOpen && p.currentPrice !== null && (
            <span className="text-xs text-gray-500">
              현재 <span className="text-gray-300 font-mono">{formatPrice(p.currentPrice)}</span>
            </span>
          )}
          <span className="text-xs text-gray-500">
            실현손익{' '}
            <Signed v={p.realizedPnl} unit=" USDT" className="text-sm font-bold" />
          </span>
        </div>
      </div>

      {/* Body stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
        <Stat label="평단 진입가" value={formatPrice(p.avgEntryPrice)} />
        <Stat label="평단 청산가" value={p.avgExitPrice !== null ? formatPrice(p.avgExitPrice) : '—'} />
        <Stat label="포지션 크기" value={`${p.entryQty} (${(p.entryQty - p.exitQty).toFixed(6)} 보유중)`} />
        <Stat label="보유 시간" value={formatDuration(p.holdingSeconds)} />
        {isOpen && p.unrealizedPnl !== null && (
          <Stat label="미실현손익(추정)" value={<Signed v={p.unrealizedPnl} unit=" USDT" />} />
        )}
        <Stat label="수수료" value={`${p.commission.toFixed(4)} ${p.commissionAsset ?? ''}`} />
      </div>

      {/* Post-close observations */}
      {p.observations.length > 0 && (
        <div className="px-3 pb-2">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider px-0.5 pb-1">
            종료 이후 가격 추이 (실제 매매 성과와 무관)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {p.observations.map((o) => (
              <div key={o.checkpoint} className="bg-[#0D1120]/60 rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5 border border-[#1F2937]/60">
                <span className="text-[9px] text-gray-600 uppercase tracking-wider">{CHECKPOINT_LABELS[o.checkpoint]}</span>
                <Signed v={o.returnPct} unit="%" className="text-xs font-semibold" />
                <span className="text-[9px] text-gray-600 font-mono">{formatPrice(o.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to manual L/S Tracker entry */}
      <div className="px-3 pb-2 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-600">L/S Tracker 기록 연결:</span>
        <select
          value={p.linkedLsEntryId ?? ''}
          disabled={linking}
          onChange={(e) => handleLinkChange(e.target.value)}
          className="bg-[#0D1120] border border-[#1F2937] text-gray-300 rounded-md px-2 py-1 text-[11px]
                     focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        >
          <option value="">연결 안 함</option>
          {candidates.map((e) => (
            <option key={e.id} value={e.id}>
              {e.side === 'LONG' ? 'L' : 'S'} · {formatTime(e.entryTime)} · {formatPrice(e.entryPrice)}
            </option>
          ))}
        </select>
        {p.linkedLsEntry && (
          <span className="text-[11px] text-emerald-400">
            ✓ 연결됨 ({formatTime(p.linkedLsEntry.entryTime)})
          </span>
        )}
      </div>

      {/* Fills */}
      <button
        onClick={() => setFillsOpen((v) => !v)}
        className="w-full px-3 py-1.5 text-[11px] text-gray-500 hover:text-gray-300 border-t border-[#1F2937] transition-colors"
      >
        체결 내역 {p.fills.length}건 {fillsOpen ? '숨기기 ▲' : '보기 ▼'}
      </button>
      {fillsOpen && (
        <div className="px-3 pb-3 overflow-x-auto">
          <table className="w-full text-[11px] text-gray-400">
            <thead>
              <tr className="text-gray-600 text-left">
                <th className="py-1 pr-3 font-normal">시각</th>
                <th className="py-1 pr-3 font-normal">이벤트</th>
                <th className="py-1 pr-3 font-normal">방향</th>
                <th className="py-1 pr-3 font-normal">가격</th>
                <th className="py-1 pr-3 font-normal">수량</th>
                <th className="py-1 pr-3 font-normal">실현손익</th>
              </tr>
            </thead>
            <tbody>
              {p.fills.map((f) => (
                <tr key={f.id} className="border-t border-[#1F2937]/60">
                  <td className="py-1 pr-3 font-mono whitespace-nowrap">{formatTime(f.time)}</td>
                  <td className="py-1 pr-3">
                    {f.eventType && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${EVENT_COLORS[f.eventType]}`}>
                        {EVENT_LABELS[f.eventType]}
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-3">{f.side === 'BUY' ? '매수' : '매도'}</td>
                  <td className="py-1 pr-3 font-mono">{formatPrice(f.price)}</td>
                  <td className="py-1 pr-3 font-mono">{f.qty}</td>
                  <td className="py-1 pr-3">
                    {f.realizedPnl !== 0 ? <Signed v={f.realizedPnl} unit=" USDT" /> : <span className="text-gray-700">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-[#0D1120] rounded-lg px-2.5 py-2 flex flex-col gap-1 border border-[#1F2937]">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-gray-200">{value}</span>
    </div>
  );
}
