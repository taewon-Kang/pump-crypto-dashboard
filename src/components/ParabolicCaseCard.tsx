'use client';
import { useState } from 'react';
import type { ParabolicCase, PointKey } from '@/types/parabolic';
import { POINT_KEYS, POINT_LABELS, SHAPE_TYPE_LABELS } from '@/types/parabolic';
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

function Pct({ v }: { v: number | null }) {
  if (v === null) return <span className="text-gray-600">—</span>;
  const positive = v >= 0;
  return (
    <span className={`font-mono tabular-nums ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
      {positive ? '+' : ''}
      {v.toFixed(1)}%
    </span>
  );
}

function Ratio({ v }: { v: number | null }) {
  if (v === null) return <span className="text-gray-600">—</span>;
  return <span className="font-mono tabular-nums text-gray-200">{v.toFixed(2)}x</span>;
}

const LEG_ROWS: { key: keyof ParabolicCase['metrics']['legs']; label: string; vol?: keyof ParabolicCase }[] = [
  { key: 'l0ToH1', label: 'L0→H1', vol: 'rise1Vol' },
  { key: 'h1ToL1', label: 'H1→L1', vol: 'drop1Vol' },
  { key: 'l1ToH2', label: 'L1→H2', vol: 'rise2Vol' },
  { key: 'h2ToL2', label: 'H2→L2', vol: 'drop2Vol' },
  { key: 'l2ToH3', label: 'L2→H3', vol: 'rise3Vol' },
  { key: 'h3ToL3', label: 'H3→L3', vol: 'postDropVol' },
  { key: 'l3ToR1', label: 'L3→R1', vol: 'reboundVol' },
];

type LabelPatch = { finalTopYn?: boolean | null; thirdWaveOccurred?: boolean | null };

interface Props {
  item: ParabolicCase;
  onDelete: (id: string) => void;
  onUpdateLabels: (id: string, patch: LabelPatch) => Promise<void>;
}

function LabelToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500">{label}</span>
      <div className="flex gap-0.5 bg-[#0D1120] border border-[#1F2937] rounded-md p-0.5">
        {[
          { key: null, text: '미정' },
          { key: true, text: 'Y' },
          { key: false, text: 'N' },
        ].map((opt) => (
          <button
            key={String(opt.key)}
            onClick={() => onChange(opt.key)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              value === opt.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-200 hover:bg-[#1F2937]'
            }`}
          >
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ParabolicCaseCard({ item, onDelete, onUpdateLabels }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleLabelChange(patch: LabelPatch) {
    setSaving(true);
    try {
      await onUpdateLabels(item.id, patch);
    } finally {
      setSaving(false);
    }
  }

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
          {item.shapeType && (
            <span className="text-[11px] text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full shrink-0">
              {SHAPE_TYPE_LABELS[item.shapeType]}
              {item.slopeCount != null && ` · 기울기 ${item.slopeCount}개`}
            </span>
          )}
          {item.thirdWaveOccurred !== null && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                item.thirdWaveOccurred ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-700/40 text-gray-400'
              }`}
            >
              3차상승 {item.thirdWaveOccurred ? 'Y' : 'N'}
            </span>
          )}
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
            L0→H3 <Pct v={item.metrics.totalRiseL0ToH3Pct} />
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
          {/* Labels — revisable any time */}
          <div className={`flex flex-wrap items-center gap-4 bg-[#0D1120] border border-[#1F2937] rounded-lg px-3 py-2 ${saving ? 'opacity-60' : ''}`}>
            <LabelToggle
              label="3차상승(H3) 발생"
              value={item.thirdWaveOccurred}
              onChange={(v) => handleLabelChange({ thirdWaveOccurred: v })}
            />
            <LabelToggle label="H3 최종고점" value={item.finalTopYn} onChange={(v) => handleLabelChange({ finalTopYn: v })} />
          </div>

          {/* Points — base/parabolic-start context first, then the core L0~L4 structure */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {item.baseLow && (
              <div className="bg-[#0D1120] rounded-lg px-2.5 py-2 border border-purple-900/40">
                <span className="text-[10px] text-purple-400 uppercase tracking-wider">Base Low</span>
                <div className="text-sm font-mono tabular-nums text-gray-200">{formatPrice(item.baseLow.price)}</div>
                <div className="text-[10px] text-gray-600">{formatTime(item.baseLow.time)}</div>
              </div>
            )}
            {item.parabolicStart && (
              <div className="bg-[#0D1120] rounded-lg px-2.5 py-2 border border-purple-900/40">
                <span className="text-[10px] text-purple-400 uppercase tracking-wider">Parabolic Start</span>
                <div className="text-sm font-mono tabular-nums text-gray-200">{formatPrice(item.parabolicStart.price)}</div>
                <div className="text-[10px] text-gray-600">{formatTime(item.parabolicStart.time)}</div>
              </div>
            )}
            {POINT_KEYS.map((key: PointKey) => {
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

          {/* Legs: %, duration, slope, volume */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 text-[10px] uppercase tracking-wider">
                  <th className="text-left font-medium py-1 pr-3">구간</th>
                  <th className="text-right font-medium py-1 px-3">변동률</th>
                  <th className="text-right font-medium py-1 px-3">기간</th>
                  <th className="text-right font-medium py-1 px-3">기울기</th>
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
                      <td className="py-1 px-3 text-right text-gray-400 font-mono tabular-nums">{leg.slope.toFixed(4)}</td>
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
                    <td className="py-1 px-3 text-right text-gray-400 font-mono tabular-nums">
                      {item.metrics.legs.r1ToL4.slope.toFixed(4)}
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
              <div className="font-mono tabular-nums text-gray-200">{item.metrics.retracement1Pct.toFixed(1)}%</div>
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">2차 되돌림</span>
              <div className="font-mono tabular-nums text-gray-200">{item.metrics.retracement2Pct.toFixed(1)}%</div>
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">H2 돌파폭</span>
              <Pct v={item.metrics.h2BreakoutOverH1Pct} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">H3 돌파폭</span>
              <Pct v={item.metrics.h3BreakoutOverH2Pct} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">상승기울기 2/1</span>
              <Ratio v={item.metrics.riseSlopeRatio21} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">상승기울기 3/2</span>
              <Ratio v={item.metrics.riseSlopeRatio32} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">상승폭 2/1</span>
              <Ratio v={item.metrics.risePctRatio21} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">상승폭 3/2</span>
              <Ratio v={item.metrics.risePctRatio32} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">L3 이탈폭(sweep)</span>
              <Pct v={item.metrics.sweepDepthPct} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">반등 회복률</span>
              <div className="font-mono tabular-nums text-gray-200">{item.metrics.recoveryRatioPct.toFixed(1)}%</div>
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">R1 vs H3</span>
              <Pct v={item.metrics.r1OverH3Pct} />
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
              <span className="text-gray-500">L0→H3 기간</span>
              <div className="font-mono tabular-nums text-gray-200">
                {(item.metrics.durationL0ToH3Hours / 24).toFixed(1)}일
              </div>
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">전체 기간</span>
              <div className="font-mono tabular-nums text-gray-200">
                {(item.metrics.totalDurationHours / 24).toFixed(1)}일
              </div>
            </div>
          </div>

          {/* Volume ratios */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">거래량 2차/1차</span>
              <Ratio v={item.metrics.volumeRatios.rise2OverRise1} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">거래량 3차/2차</span>
              <Ratio v={item.metrics.volumeRatios.rise3OverRise2} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">하락/3차상승 거래량</span>
              <Ratio v={item.metrics.volumeRatios.postDropOverRise3} />
            </div>
            <div className="bg-[#0D1120] rounded-lg px-2.5 py-1.5 border border-[#1F2937]">
              <span className="text-gray-500">반등/하락 거래량</span>
              <Ratio v={item.metrics.volumeRatios.reboundOverPostDrop} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
