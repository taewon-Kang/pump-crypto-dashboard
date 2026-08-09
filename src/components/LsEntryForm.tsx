'use client';
import { useState } from 'react';
import type { Side } from '@/types/ls';
import CoinSelector from '@/components/CoinSelector';
import SideSelector from '@/components/SideSelector';
import { toDateTimeLocal } from '@/lib/date';

interface Props {
  onSubmit: (data: { symbol: string; side: Side; entryTime: number; note: string }) => Promise<void>;
}

export default function LsEntryForm({ onSubmit }: Props) {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState<Side>('LONG');
  const [entryDT, setEntryDT] = useState(() => toDateTimeLocal(new Date()));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!entryDT) {
      setError('진입 시각을 선택해주세요.');
      return;
    }
    const entryTime = new Date(entryDT).getTime();
    if (entryTime > Date.now()) {
      setError('진입 시각은 현재보다 이후일 수 없습니다.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ symbol, side, entryTime, note });
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-[#1F2937] p-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">코인</span>
          <CoinSelector value={symbol} onChange={setSymbol} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">방향</span>
          <SideSelector value={side} onChange={setSide} />
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-[180px]">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">진입 시각</span>
          <input
            type="datetime-local"
            value={entryDT}
            onChange={(e) => setEntryDT(e.target.value)}
            className="bg-[#111827] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-0.5 flex-[2] min-w-[180px]">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">메모 (선택)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 되돌림 이후 진입"
            className="bg-[#111827] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-2 text-sm
                       placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     text-white text-sm font-semibold transition-colors shadow-sm"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              기록 중...
            </>
          ) : (
            '기록하기'
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </div>
  );
}
