'use client';
import { TIMEFRAME_OPTIONS, type Timeframe } from '@/types/parabolic';

interface Props {
  value: Timeframe;
  onChange: (v: Timeframe) => void;
}

export default function ParabolicTimeframeSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Timeframe)}
      className="bg-[#1A2035] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-2 text-sm font-semibold
                 focus:outline-none focus:border-blue-500 transition-colors"
    >
      {TIMEFRAME_OPTIONS.map((tf) => (
        <option key={tf} value={tf}>
          {tf}
        </option>
      ))}
    </select>
  );
}
