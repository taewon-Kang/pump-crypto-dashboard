'use client';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const OPTIONS = ['1h', '4h', '1d', '1w'];

export default function TimeframeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-[#111827] border border-[#1F2937] rounded-lg p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === opt
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
