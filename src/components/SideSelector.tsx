'use client';
import type { Side } from '@/types/ls';

interface Props {
  value: Side;
  onChange: (v: Side) => void;
}

export default function SideSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-[#111827] border border-[#1F2937] rounded-lg p-1">
      <button
        onClick={() => onChange('LONG')}
        className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
          value === 'LONG'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]'
        }`}
      >
        Long
      </button>
      <button
        onClick={() => onChange('SHORT')}
        className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
          value === 'SHORT'
            ? 'bg-red-600 text-white shadow-sm'
            : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]'
        }`}
      >
        Short
      </button>
    </div>
  );
}
