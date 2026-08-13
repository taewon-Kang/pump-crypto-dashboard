import type { CheckpointStats } from '@/lib/lsStats';

function fmt(v: number | null): string {
  if (v === null) return '–';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** Exact-value table view of the same data the bar chart plots — the accessible fallback. */
export default function CheckpointStatsTable({ data }: { data: CheckpointStats[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-[#1F2937]">
            <th className="text-left font-medium py-1.5 pr-3">기간</th>
            <th className="text-left font-medium py-1.5 pr-3">구분</th>
            <th className="text-right font-medium py-1.5 pr-3">평균</th>
            <th className="text-right font-medium py-1.5 pr-3">최고</th>
            <th className="text-right font-medium py-1.5 pr-3">최저</th>
            <th className="text-right font-medium py-1.5">n</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {data.map((row) =>
            row.series.map((s, i) => (
              <tr key={`${row.checkpoint}-${s.key}`} className="border-b border-[#1F2937]/60 last:border-0">
                {i === 0 && (
                  <td className="py-1.5 pr-3 text-gray-300 font-medium align-top" rowSpan={row.series.length}>
                    {row.label}
                  </td>
                )}
                <td className="py-1.5 pr-3 text-gray-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                </td>
                <td className={`py-1.5 pr-3 text-right ${cellColor(s.avg)}`}>{fmt(s.avg)}</td>
                <td className={`py-1.5 pr-3 text-right ${cellColor(s.best)}`}>{fmt(s.best)}</td>
                <td className={`py-1.5 pr-3 text-right ${cellColor(s.worst)}`}>{fmt(s.worst)}</td>
                <td className="py-1.5 text-right text-gray-600">{s.n}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function cellColor(v: number | null): string {
  if (v === null) return 'text-gray-600';
  return v >= 0 ? 'text-emerald-400' : 'text-red-400';
}
