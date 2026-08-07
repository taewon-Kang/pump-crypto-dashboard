'use client';
import { COIN_OPTIONS } from '@/types';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function CoinSelector({ value, onChange }: Props) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          appearance-none
          bg-[#1A2035] border border-[#2D3748]
          text-gray-100 font-semibold
          rounded-lg px-4 py-2 pr-9 text-sm
          focus:outline-none focus:border-blue-500
          cursor-pointer hover:border-[#4A5568]
          transition-colors
        "
      >
        {COIN_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1A2035]">
            {opt.label} Perpetual
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
