'use client';
import { useState } from 'react';
import type { CheckpointStats, SeriesDef } from '@/lib/lsStats';

type Metric = 'avg' | 'best' | 'worst';

interface Props {
  data: CheckpointStats[];
  seriesDefs: SeriesDef[];
  metric: Metric;
}

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };
const GRID_TEXT = '#6B7280'; // one step off the #111827 card surface — recessive
const BASELINE_TEXT = '#9CA3AF';

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

/** "Nice" symmetric axis max — round up to a clean step so ticks read as 0 / 5 / 10 style numbers. */
function niceMax(absMax: number): number {
  if (absMax <= 0) return 5;
  const step = absMax <= 10 ? 1 : absMax <= 50 ? 5 : absMax <= 200 ? 20 : 50;
  return Math.ceil(absMax / step) * step;
}

interface Hover {
  x: number;
  y: number;
  seriesLabel: string;
  seriesColor: string;
  checkpointLabel: string;
  value: number;
  n: number;
}

/**
 * Grouped bar chart around a zero baseline: one bar per series per checkpoint.
 * Categorical color (identity), direct end-labels, legend above, hover tooltip
 * per mark — per the dataviz skill. Values can be null (no elapsed samples yet)
 * and render as a muted "–" instead of a bar.
 */
export default function CheckpointBarChart({ data, seriesDefs, metric }: Props) {
  const [hover, setHover] = useState<Hover | null>(null);

  const allValues = data.flatMap((row) => row.series.map((s) => s[metric])).filter((v): v is number => v !== null);
  const absMax = niceMax(Math.max(1, ...allValues.map((v) => Math.abs(v))));

  const plotX0 = PAD.left;
  const plotX1 = WIDTH - PAD.right;
  const plotY0 = PAD.top;
  const plotY1 = HEIGHT - PAD.bottom;
  const plotW = plotX1 - plotX0;
  const plotH = plotY1 - plotY0;
  const zeroY = plotY0 + plotH / 2;

  const yFor = (v: number) => zeroY - (v / absMax) * (plotH / 2);

  const slotW = plotW / data.length;
  const barW = Math.min(24, (slotW * 0.6) / seriesDefs.length);
  const barGap = 2;
  const groupW = barW * seriesDefs.length + barGap * (seriesDefs.length - 1);

  const ticks = [-absMax, -absMax / 2, 0, absMax / 2, absMax];

  return (
    <div>
      {/* Legend — always present for 2+ series */}
      <div className="flex items-center gap-4 px-1 pb-2">
        {seriesDefs.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" role="img">
          {/* Gridlines + y ticks */}
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
                {t === 0 ? '0%' : `${t > 0 ? '+' : ''}${t}%`}
              </text>
            </g>
          ))}

          {/* Bars */}
          {data.map((row, i) => {
            const slotCenter = plotX0 + slotW * i + slotW / 2;
            const groupX0 = slotCenter - groupW / 2;
            return (
              <g key={row.checkpoint}>
                <text x={slotCenter} y={plotY1 + 18} fill={BASELINE_TEXT} fontSize={11} textAnchor="middle">
                  {row.label}
                </text>
                {row.series.map((s, j) => {
                  const x = groupX0 + j * (barW + barGap);
                  const cx = x + barW / 2;
                  if (s[metric] === null) {
                    return (
                      <text key={s.key} x={cx} y={zeroY} fill={GRID_TEXT} fontSize={11} textAnchor="middle" dominantBaseline="middle">
                        –
                      </text>
                    );
                  }
                  const v = s[metric]!;
                  const y = yFor(v);
                  const top = Math.min(y, zeroY);
                  const h = Math.max(1, Math.abs(y - zeroY));
                  const rTop = v >= 0 ? 4 : 0;
                  const rBottom = v < 0 ? 4 : 0;
                  return (
                    <g
                      key={s.key}
                      onMouseEnter={() =>
                        setHover({ x: cx, y: top, seriesLabel: s.label, seriesColor: s.color, checkpointLabel: row.label, value: v, n: s.n })
                      }
                      onMouseLeave={() => setHover(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Wider invisible hit target than the thin bar itself */}
                      <rect x={x - 3} y={plotY0} width={barW + 6} height={plotH} fill="transparent" />
                      <path
                        d={roundedBarPath(x, top, barW, h, rTop, rBottom)}
                        fill={s.color}
                      />
                      <text
                        x={cx}
                        y={v >= 0 ? y - 6 : y + 14}
                        fill={BASELINE_TEXT}
                        fontSize={10}
                        textAnchor="middle"
                        className="tabular-nums"
                      >
                        {fmtPct(v)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            className="absolute z-10 pointer-events-none bg-[#0D1120] border border-[#2D3748] rounded-lg px-2.5 py-1.5 text-xs shadow-lg -translate-x-1/2"
            style={{ left: `${(hover.x / WIDTH) * 100}%`, top: `${(hover.y / HEIGHT) * 100}%`, marginTop: -8 }}
          >
            <div className="flex items-center gap-1.5 text-gray-200 font-semibold">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: hover.seriesColor }} />
              {hover.seriesLabel} · {hover.checkpointLabel}
            </div>
            <div className="text-gray-400 mt-0.5 tabular-nums">
              {fmtPct(hover.value)} <span className="text-gray-600">(n={hover.n})</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Rect with independently roundable top/bottom corners (top for positive bars, bottom for negative). */
function roundedBarPath(x: number, y: number, w: number, h: number, rTop: number, rBottom: number): string {
  const rt = Math.min(rTop, h / 2, w / 2);
  const rb = Math.min(rBottom, h / 2, w / 2);
  return `
    M ${x} ${y + rt}
    Q ${x} ${y} ${x + rt} ${y}
    L ${x + w - rt} ${y}
    Q ${x + w} ${y} ${x + w} ${y + rt}
    L ${x + w} ${y + h - rb}
    Q ${x + w} ${y + h} ${x + w - rb} ${y + h}
    L ${x + rb} ${y + h}
    Q ${x} ${y + h} ${x} ${y + h - rb}
    Z
  `;
}
