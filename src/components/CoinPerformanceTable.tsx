'use client';
import { useState, useMemo, type ReactNode } from 'react';
import type { CoinPerformance, SortColumn, SortDir, Exchange } from '@/types/performance';
import { formatPrice } from '@/lib/format';

interface Props {
  data: CoinPerformance[];
  exchange: Exchange;
  searchQuery: string;
  selectedSymbol?: string | null;
  onSelect?: (row: CoinPerformance) => void;
}

function SortIcon({ col, current, dir }: { col: SortColumn; current: SortColumn; dir: SortDir }) {
  if (col !== current) {
    return (
      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return dir === 'desc' ? (
    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}

const HEADER_CLASS = 'px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider';
const CELL_CLASS = 'px-3 py-2.5 text-sm';

interface ThProps {
  col: SortColumn;
  children: ReactNode;
  sortCol: SortColumn;
  sortDir: SortDir;
  onSort: (col: SortColumn) => void;
}

function Th({ col, children, sortCol, sortDir, onSort }: ThProps) {
  return (
    <th
      className={`${HEADER_CLASS} cursor-pointer hover:text-gray-300 select-none transition-colors`}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon col={col} current={sortCol} dir={sortDir} />
      </div>
    </th>
  );
}

export default function CoinPerformanceTable({
  data,
  exchange,
  searchQuery,
  selectedSymbol,
  onSelect,
}: Props) {
  const [sortCol, setSortCol] = useState<SortColumn>('change');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(col: SortColumn) {
    if (col === sortCol) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'symbol' ? 'asc' : 'desc');
    }
  }

  const sorted = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    const filtered = q
      ? data.filter((r) => r.symbol.toUpperCase().includes(q) || r.name.includes(searchQuery.trim()))
      : data;

    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortCol === 'symbol') diff = a.symbol.localeCompare(b.symbol);
      else if (sortCol === 'startPrice') diff = a.startPrice - b.startPrice;
      else if (sortCol === 'endPrice') diff = a.endPrice - b.endPrice;
      else diff = a.change - b.change;
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [data, sortCol, sortDir, searchQuery]);

  if (!data.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#1F2937]">
      <table className="w-full text-left">
        <thead className="bg-[#111827] border-b border-[#1F2937]">
          <tr>
            <th className={`${HEADER_CLASS} w-12 text-center`}>#</th>
            <Th col="symbol" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>코인</Th>
            <Th col="startPrice" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>시작 가격</Th>
            <Th col="endPrice" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>종료 가격</Th>
            <Th col="change" sortCol={sortCol} sortDir={sortDir} onSort={handleSort}>상승률</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const isPositive = row.change >= 0;
            const isSelected = row.symbol === selectedSymbol;
            return (
              <tr
                key={row.symbol}
                onClick={() => onSelect?.(row)}
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelect(row);
                  }
                }}
                className={`border-b border-[#1F2937] last:border-0 transition-colors ${
                  onSelect ? 'cursor-pointer' : ''
                } ${isSelected ? 'bg-blue-500/10 hover:bg-blue-500/15' : 'hover:bg-[#111827]'}`}
              >
                <td className={`${CELL_CLASS} text-center text-gray-600 font-mono text-xs`}>
                  {idx + 1}
                </td>
                <td className={`${CELL_CLASS}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100">{row.symbol}</span>
                    <span className="text-xs text-gray-600 hidden sm:inline truncate max-w-[120px]">
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className={`${CELL_CLASS} font-mono text-gray-300`}>
                  {formatPrice(row.startPrice, exchange)}
                </td>
                <td className={`${CELL_CLASS} font-mono text-gray-300`}>
                  {formatPrice(row.endPrice, exchange)}
                </td>
                <td className={CELL_CLASS}>
                  <span
                    className={`inline-block font-semibold font-mono tabular-nums ${
                      isPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {row.change.toFixed(2)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && searchQuery && (
        <div className="py-12 text-center text-gray-600 text-sm">
          &quot;{searchQuery}&quot; 검색 결과 없음
        </div>
      )}
    </div>
  );
}
