'use client';
import type { LsEntry } from '@/types/ls';
import { CHECKPOINT_LABELS } from '@/types/ls';
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

function Pct({ v, className = '' }: { v: number; className?: string }) {
  const positive = v >= 0;
  return (
    <span className={`font-mono tabular-nums ${positive ? 'text-emerald-400' : 'text-red-400'} ${className}`}>
      {positive ? '+' : ''}
      {v.toFixed(2)}%
    </span>
  );
}

interface Props {
  entry: LsEntry;
  onDelete: (id: string) => void;
}

export default function LsEntryCard({ entry, onDelete }: Props) {
  const isLong = entry.side === 'LONG';

  return (
    <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden">
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
            {entry.symbol.replace('USDT', '')}
            <span className="text-gray-600">/USDT</span>
          </span>
          <span className="text-xs text-gray-500 font-mono tabular-nums shrink-0 hidden sm:inline">
            진입 {formatPrice(entry.entryPrice)}
          </span>
          <span className="text-xs text-gray-600 shrink-0 hidden md:inline">{formatTime(entry.entryTime)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.metrics && (
            <span className="text-xs text-gray-500">
              현재 <span className="text-gray-300 font-mono">{formatPrice(entry.metrics.currentPrice)}</span>
            </span>
          )}
          <button
            onClick={() => onDelete(entry.id)}
            aria-label="기록 삭제"
            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-[#1F2937] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile-only entry meta (hidden on the header row above sm) */}
      <div className="px-4 pt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 sm:hidden">
        <span className="font-mono">진입 {formatPrice(entry.entryPrice)}</span>
        <span className="text-gray-600">{formatTime(entry.entryTime)}</span>
      </div>

      {entry.note && (
        <div className="px-4 pt-2 text-xs text-gray-500 italic truncate">&ldquo;{entry.note}&rdquo;</div>
      )}

      {/* Error */}
      {entry.error && (
        <div className="px-4 py-3 text-xs text-red-400">⚠ {entry.error}</div>
      )}

      {/* Checkpoint grid */}
      {entry.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3">
          {CHECKPOINT_LABELS.map(({ key, label }) => {
            const cp = entry.metrics!.checkpoints[key];
            return (
              <div
                key={key}
                className="bg-[#0D1120] border border-[#1F2937] rounded-lg px-2.5 py-2 flex flex-col gap-1"
              >
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
                {cp.elapsed ? (
                  <Pct v={cp.returnPct!} className="text-base font-bold" />
                ) : (
                  <span className="text-sm font-medium text-gray-600">진행중</span>
                )}
                <span className="text-[10px] text-gray-600 leading-tight">
                  최고 <Pct v={cp.bestPct} /> · 최저 <Pct v={cp.worstPct} />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
