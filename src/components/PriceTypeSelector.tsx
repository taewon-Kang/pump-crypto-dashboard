'use client';
import type { PriceType } from '@/types/performance';
import { PRICE_TYPE_OPTIONS } from '@/types/performance';

interface Props {
  startType: PriceType;
  endType: PriceType;
  onStartChange: (v: PriceType) => void;
  onEndChange: (v: PriceType) => void;
}

function PriceTypeBtn({
  options,
  value,
  onChange,
  label,
}: {
  options: typeof PRICE_TYPE_OPTIONS;
  value: PriceType;
  onChange: (v: PriceType) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">{label}</span>
      <div className="flex gap-0.5 bg-[#111827] border border-[#1F2937] rounded-lg p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              value === opt.value
                ? 'bg-violet-600 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#1F2937]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PriceTypeSelector({ startType, endType, onStartChange, onEndChange }: Props) {
  return (
    <div className="flex items-end gap-2 flex-wrap">
      <PriceTypeBtn
        label="시작 기준"
        options={PRICE_TYPE_OPTIONS}
        value={startType}
        onChange={onStartChange}
      />
      <span className="text-gray-600 pb-1.5">→</span>
      <PriceTypeBtn
        label="종료 기준"
        options={PRICE_TYPE_OPTIONS}
        value={endType}
        onChange={onEndChange}
      />
    </div>
  );
}
