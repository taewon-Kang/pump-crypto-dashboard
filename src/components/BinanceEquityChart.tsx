'use client';
import { useState } from 'react';
import type { EquityPoint } from '@/lib/binanceStats';

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 24, left: 60 };
const GRID_TEXT = '#6B7280';
const BASELINE_TEXT = '#9CA3AF';

/** "Nice" symmetric axis max — round up to a clean step, same idiom as CheckpointBarChart. */
function niceMax(absMax: number): number {
  if (absMax <= 0) return 10;
  const step = absMax <= 10 ? 1 : absMax <= 50 ? 5 : absMax <= 200 ? 20 : absMax <= 1000 ? 100 : 500;
  return Math.ceil(absMax / step) * step;
}

function fmtUsdt(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)} USDT`;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

interface Props {
  data: EquityPoint[]; // sorted ascending by time
}

/** Cumulative realized (net of commission) PnL over time — closed real positions only. */
export default function BinanceEquityChart({ data }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) return null;

  const values = data.map((d) => d.cumulativePnl);
  const absMax = niceMax(Math.max(1, ...values.map((v) => Math.abs(v))));

  const plotX0 = PAD.left;
  const plotX1 = WIDTH - PAD.right;
  const plotY0 = PAD.top;
  const plotY1 = HEIGHT - PAD.bottom;
  const plotW = plotX1 - plotX0;
  const plotH = plotY1 - plotY0;

  const yFor = (v: number) => plotY1 - ((v + absMax) / (2 * absMax)) * plotH;
  const xFor = (i: number) => (data.length === 1 ? plotX0 + plotW / 2 : plotX0 + (i / (data.length - 1)) * plotW);
  const zeroY = yFor(0);

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.cumulativePnl)}`).join(' ');
  const lastValue = values[values.length - 1];
  const lineColor = lastValue >= 0 ? '#10B981' : '#EF4444';
  const areaPath = `${linePath} L ${xFor(data.length - 1)} ${zeroY} L ${xFor(0)} ${zeroY} Z`;

  const ticks = [-absMax, -absMax / 2, 0, absMax / 2, absMax];
  const labelCount = Math.min(5, data.length);
  const labelIdxs = [...new Set(Array.from({ length: labelCount }, (_, i) => Math.round((i / Math.max(1, labelCount - 1)) * (data.length - 1))))];
  const hitW = plotW / Math.max(1, data.length - 1);

  const hover = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img" onMouseLeave={() => setHoverIdx(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={plotX0}
              x2={plotX1}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke={t === 0 ? BASELINE_TEXT : GRID_TEXT}
              strokeWidth={1}
              opacity={t === 0 ? 0.5 : 0.3}
            />
            <text x={plotX0 - 8} y={yFor(t)} fill={GRID_TEXT} fontSize={10} textAnchor="end" dominantBaseline="middle">
              {t === 0 ? '0' : `${t > 0 ? '+' : ''}${t}`}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={lineColor} opacity={0.12} />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} />

        {labelIdxs.map((i) => (
          <text key={i} x={xFor(i)} y={HEIGHT - 6} fill={BASELINE_TEXT} fontSize={10} textAnchor="middle">
            {fmtDate(data[i].time * 1000)}
          </text>
        ))}

        {data.map((d, i) => (
          <rect
            key={i}
            x={xFor(i) - hitW / 2 - 2}
            y={plotY0}
            width={hitW + 4}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {hover && <circle cx={xFor(hoverIdx!)} cy={yFor(hover.cumulativePnl)} r={4} fill={lineColor} stroke="#111827" strokeWidth={2} />}
      </svg>

      {hover && (
        <div
          className="absolute z-10 pointer-events-none bg-[#0D1120] border border-[#2D3748] rounded-lg px-2.5 py-1.5 text-xs shadow-lg -translate-x-1/2"
          style={{ left: `${(xFor(hoverIdx!) / WIDTH) * 100}%`, top: `${Math.max(0, (yFor(hover.cumulativePnl) / HEIGHT) * 100 - 18)}%` }}
        >
          <div className="text-gray-400">{fmtDate(hover.time * 1000)}</div>
          <div className={`font-semibold tabular-nums ${hover.cumulativePnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtUsdt(hover.cumulativePnl)}
          </div>
        </div>
      )}
    </div>
  );
}
