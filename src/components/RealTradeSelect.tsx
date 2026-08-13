'use client';

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}

/** Select for whether a call was real money or just a tracked read on the market. */
export default function RealTradeSelect({ value, onChange, className = '' }: Props) {
  return (
    <select
      value={value ? 'REAL' : 'WATCH'}
      onChange={(e) => onChange(e.target.value === 'REAL')}
      className={`bg-[#111827] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:border-blue-500 transition-colors ${className}`}
    >
      <option value="REAL">실제 투자</option>
      <option value="WATCH">관점용</option>
    </select>
  );
}
