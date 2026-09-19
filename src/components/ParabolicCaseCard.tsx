'use client';
import { useState } from 'react';
import type { ParabolicCase, PointKey } from '@/types/parabolic';
import { POINT_KEYS, POINT_LABELS } from '@/types/parabolic';
import { formatPrice, formatVolume } from '@/lib/format';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Pct({ v }: { v: number }) {
  const positive = v >= 0;
  return (
    <span className={`font-mono tabular-nums ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
      {positive ? '+' : ''}
      {v.toFixed(1)}%
    </span>
  );
}

const LEG_ROWS: { key: keyof ParabolicCase['metrics']['legs']; from: PointKey; to: PointKey; label: string; vol?: keyof ParabolicCase }[] = [
  { key: 'l0ToH1', from: 'l0', to: 'h1', label: 'L0→H1', vol: 'rise1Vol' },
  { key: 'h1ToL1', from: 'h1', to: 'l1', label: 'H1→L1', vol: 'drop1Vol' },
  { key: 'l1ToH2', from: 'l1', to: 'h2', label: 'L1→H2', vol: 'rise2Vol' },
  { key: 'h2ToL2', from: 'h2', to: 'l2', label: 'H2→L2', vol: 'drop2Vol' },
  { key: 'l2ToH3', from: 'l2', to: 'h3', label: 'L2→H3', vol: 'rise3Vol' },
  { key: 'h3ToL3', from: 'h3', to: 'l3', label: 'H3→L3', vol: 'postDropVol' },
  { key: 'l3ToR1', from: 'l3', to: 'r1', label: 'L3→R1', vol: 'reboundVol' },
];

interface Props {
  item: ParabolicCase;
  onDelete: (id: string) => void;
}

export default function ParabolicCaseCard({ item, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#1F2937] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-gray-100 truncate">
            {item.symbol.replace('USDT', '')}
            <span className="text-gray-600">/USDT</span>
          </span>
          <span className="text-[11px] text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full shrink-0">
            {item.timeframe}
          </span>
          <span className="text-xs text-gray-600 shrink-0 hidden md:inline">
            {formatTime(item.points.l0.time)} ~ {formatTime((item.points.l4 ?? item.points.r1).time)}
          </span>
          {item.finalTopYn !== null && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                item.finalTopYn ? 'bg-red-900/40 text-red-400' : 'bg-gray-700/40 text-gray-400'
              }`}
            >
              최종고점 {item.finalTopYn ? 'Y' : 'N'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 font-mono tabular-nums">
            총상승 <Pct v={item.metrics.totalRisePct} />
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-[#1F2937] transition-colors"
            aria-label={expanded ? '상세 숨기기' : '상세 보기'}
            aria-pressed={expanded}
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(item.id)}
            aria-label="사례 삭제"
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

      {item.notes && <div className="px-4 pt-2 text-xs text-gray-500 italic truncate">&ldquo;{item.notes}&rdquo;</div>}

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Points */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {POINT_KEYS.map((key) => {
              const p = item.points[key];
              if (!p) return null;
              return (
                <div key={key} className="bg-[#0D1120] rounded-lg px-2.5 py-2 border border-[#1F2937]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{POINT_LABELS[key]}</span>
                  <div className="text-sm font-mono tabular-nums text-gray-200">{formatPrice(p.price)}</div>
                  <div className="text-[10px] text-gray-600">{formatTime(p.time)}</div>
                </div>
              );
            })}
          </div>

          {/* Legs: %, duration, volume */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-[10px] uppercase tracking-wider">
                  <th className="text-left font-medium py-1 pr-3">구간</th>
                  <th className="text-right font-medium py-1 px-3">변동률</th>
                  <th className="text-right font-medium py-1 px-3">기간</th>
                  <th className="text-right font-medium py-1 pl-3">거래량</th>
                </tr>
              </thead>
              <tbody>
                {LEG_ROWS.map((row) => {
                  const leg = item.metrics.legs[row.key];
                  if (!leg) return null;
                  return (
                    <tr key={row.label} className="border-t border-[#1F2937]/60">
                      <td className="py-1 pr-3 text-gray-400">{row.label}</td>
                      <td className="py-1 px-3 text-right">
                        <Pct v={leg.pct} />
                      </td>
                      <td className="py-1 px-3 text-right text-gray-400 font-mono tabular-nums">
                        {leg.durationHours.toFixed(1)}h
                      </td>
                      <td className="py-1 pl-3 text-right text-gray-400 font-mono tabular-nums">
                        {row.vol ? formatVolume(item[row.vol] as number) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {item.metrics.legs.r1ToL4 && (
                  <tr className="border-t border-[#1F2937]/60">
                    <td className="py-1 pr-3 text-gray-400">R1→L4</td>
                    <td className="py-1 px-3 text-right">
                      <Pct v={item.metrics.legs.r1ToL4.pct} />
                    </td>
                    <td className="py-1 px-3 text-right text-gray-400 font-mono tabular-nums">
                      {item.metrics.legs.r1ToL4.durationHours.toFixed(1)}h
                    </td>
                    <td className="py-1 pl-3 text-right text-gray-600">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Structure ratios */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">1차 되돌림</span>
              <div className="font-mono tabular-nums text-gray-200">{item.metrics.retrace1Pct.toFixed(1)}%</div>
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">2차 되돌림</span>
              <div className="font-mono tabular-nums text-gray-200">{item.metrics.retrace2Pct.toFixed(1)}%</div>
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">반등 회복률</span>
              <div className="font-mono tabular-nums text-gray-200">{item.metrics.reboundRetracePct.toFixed(1)}%</div>
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">L1 vs L0</span>
              <Pct v={item.metrics.l1VsL0Pct} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">L2 vs L1</span>
              <Pct v={item.metrics.l2VsL1Pct} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">전체 기간</span>
              <div className="font-mono tabular-nums text-gray-200">
                {(item.metrics.totalDurationHours / 24).toFixed(1)}일
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
