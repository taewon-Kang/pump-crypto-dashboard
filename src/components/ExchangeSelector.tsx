'use client';
import type { Exchange } from '@/types/performance';

interface Props {
  value: Exchange;
  onChange: (v: Exchange) => void;
}

const OPTIONS: { value: Exchange; label: string }[] = [
  { value: 'binance', label: 'Binance' },
  { value: 'upbit', label: 'Upbit' },
];

export default function ExchangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-[#111827] border border-[#1F2937] rounded-lg p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === opt.value
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
