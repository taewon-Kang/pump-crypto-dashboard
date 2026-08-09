'use client';

interface Props {
  startValue: string;
  endValue: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

export default function DateRangePicker({ startValue, endValue, onStartChange, onEndChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">시작</span>
        <input
          type="datetime-local"
          value={startValue}
          onChange={(e) => onStartChange(e.target.value)}
          className="bg-[#111827] border border-[#1F2937] text-gray-200 text-sm rounded-lg px-3 py-1.5
                     focus:outline-none focus:border-blue-500 transition-colors
                     [color-scheme:dark]"
        />
      </div>

      <span className="text-gray-600 mt-4">→</span>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">종료</span>
        <input
          type="datetime-local"
          value={endValue}
          onChange={(e) => onEndChange(e.target.value)}
          className="bg-[#111827] border border-[#1F2937] text-gray-200 text-sm rounded-lg px-3 py-1.5
                     focus:outline-none focus:border-blue-500 transition-colors
                     [color-scheme:dark]"
        />
      </div>
    </div>
  );
}
