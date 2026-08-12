'use client';
import { useState } from 'react';
import type { LsEntry } from '@/types/ls';
import { CHECKPOINT_LABELS, pumpPhaseLabel } from '@/types/ls';
import { formatPrice } from '@/lib/format';
import LsEntryEditForm, { type LsEntryEdits } from '@/components/LsEntryEditForm';

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
  onEdit: (id: string, edits: LsEntryEdits) => Promise<void>;
  onEnd: (id: string) => void;
  onReopen: (id: string) => void;
  /** True once this entry's symbol has received at least one live WS tick. */
  live?: boolean;
}

export default function LsEntryCard({ entry, onDelete, onEdit, onEnd, onReopen, live = false }: Props) {
  const [editing, setEditing] = useState(false);
  const isLong = entry.side === 'LONG';
  const ended = entry.endedAt !== null;
  const phaseLabel = pumpPhaseLabel(entry.pumpPhase);

  if (editing) {
    return (
      <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden">
        <LsEntryEditForm
          entry={entry}
          onCancel={() => setEditing(false)}
          onSave={async (edits) => {
            await onEdit(entry.id, edits);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`bg-[#111827] rounded-xl border overflow-hidden ${ended ? 'border-[#1F2937]/60 opacity-75' : 'border-[#1F2937]'}`}>
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
          {phaseLabel && (
            <span className="text-[11px] text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full shrink-0">
              {phaseLabel}
            </span>
          )}
          {ended && (
            <span className="text-[11px] text-gray-500 bg-[#1F2937] px-2 py-0.5 rounded-full shrink-0">
              종료됨 {formatTime(entry.endedAt!)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.metrics && (
            <span className="text-xs text-gray-500 inline-flex items-center gap-1">
              {live && !ended && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />}
              {ended ? '종료 시점' : '현재'} <span className="text-gray-300 font-mono">{formatPrice(entry.metrics.currentPrice)}</span>
            </span>
          )}
          <button
            onClick={() => setEditing(true)}
            aria-label="기록 수정"
            className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-[#1F2937] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          {ended ? (
            <button
              onClick={() => onReopen(entry.id)}
              className="px-2 py-1 rounded-md text-[11px] font-semibold text-gray-400 hover:text-gray-200 hover:bg-[#1F2937] transition-colors"
            >
              재개
            </button>
          ) : (
            <button
              onClick={() => onEnd(entry.id)}
              className="px-2 py-1 rounded-md text-[11px] font-semibold text-amber-500/80 hover:text-amber-400 hover:bg-[#1F2937] transition-colors"
            >
              기록 종료
            </button>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3 pb-1.5">
          {CHECKPOINT_LABELS.map(({ key, label }) => {
            const cp = entry.metrics!.checkpoints[key];
            // "now" is always elapsed (it's the live checkpoint, not a fixed
            // one) — only 3d/7d/14d/30d actually "confirm" once their target
            // time has passed, so only those get the highlight border.
            const confirmed = key !== 'now' && cp.elapsed;
            const confirmedBorder =
              cp.returnPct !== null && cp.returnPct >= 0 ? 'border-emerald-500/70' : 'border-red-500/70';
            return (
              <div
                key={key}
                className={`bg-[#0D1120] rounded-lg px-2.5 py-2 flex flex-col gap-1 border ${
                  confirmed ? confirmedBorder : 'border-[#1F2937]'
                }`}
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

      {/* BTC benchmark: same-window MFE/MAE/close-return for BTC itself, for market-context comparison */}
      {entry.btcMetrics && (
        <div className="px-3 pb-3 pt-1">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider px-0.5 pb-1">
            BTC 동일 기간 {entry.btcPriceAtEntry !== null && (
              <span className="font-mono normal-case">(기준 {formatPrice(entry.btcPriceAtEntry)})</span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {CHECKPOINT_LABELS.map(({ key, label }) => {
              const cp = entry.btcMetrics!.checkpoints[key];
              return (
                <div
                  key={key}
                  className="bg-[#0D1120]/60 rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5 border border-[#1F2937]/60"
                >
                  <span className="text-[9px] text-gray-600 uppercase tracking-wider">BTC {label}</span>
                  {cp.elapsed ? (
                    <Pct v={cp.returnPct!} className="text-xs font-semibold" />
                  ) : (
                    <span className="text-xs font-medium text-gray-600">진행중</span>
                  )}
                  <span className="text-[9px] text-gray-600 leading-tight">
                    최고 <Pct v={cp.bestPct} /> · 최저 <Pct v={cp.worstPct} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
