'use client';
import { useState } from 'react';
import type { LsEntry, PumpPhase, Side } from '@/types/ls';
import CoinSelector from '@/components/CoinSelector';
import SideSelector from '@/components/SideSelector';
import PumpPhaseSelect from '@/components/PumpPhaseSelect';
import RealTradeSelect from '@/components/RealTradeSelect';
import { toDateTimeLocal } from '@/lib/date';

export interface LsEntryEdits {
  symbol: string;
  side: Side;
  entryTime: number;
  note: string;
  pumpPhase: PumpPhase | null;
  isRealTrade: boolean;
}

interface Props {
  entry: LsEntry;
  onSave: (edits: LsEntryEdits) => Promise<void>;
  onCancel: () => void;
}

/** Inline edit form for an existing entry — mirrors LsEntryForm's fields, prefilled. */
export default function LsEntryEditForm({ entry, onSave, onCancel }: Props) {
  const [symbol, setSymbol] = useState(entry.symbol);
  const [side, setSide] = useState<Side>(entry.side);
  const [entryDT, setEntryDT] = useState(() => toDateTimeLocal(new Date(entry.entryTime)));
  const [note, setNote] = useState(entry.note ?? '');
  const [pumpPhase, setPumpPhase] = useState<PumpPhase | null>(entry.pumpPhase);
  const [isRealTrade, setIsRealTrade] = useState(entry.isRealTrade);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
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
      await onSave({ symbol, side, entryTime, note, pumpPhase, isRealTrade });
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-3 bg-[#0D1120] border-b border-[#1F2937] space-y-3">
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
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">펌핑 단계 (선택)</span>
          <PumpPhaseSelect value={pumpPhase} onChange={setPumpPhase} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">투자 여부</span>
          <RealTradeSelect value={isRealTrade} onChange={setIsRealTrade} />
        </div>
        <div className="flex flex-col gap-0.5 flex-[2] min-w-[180px]">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">메모 (선택)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-[#111827] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-2 text-sm
                       placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                       disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-[#1F2937] hover:bg-[#2D3748] disabled:opacity-50
                       text-gray-300 text-sm font-semibold transition-colors"
          >
            취소
          </button>
        </div>
      </div>
      {(symbol !== entry.symbol || new Date(entryDT).getTime() !== entry.entryTime) && (
        <p className="text-[11px] text-amber-400/80">
          ⚠ 코인 또는 진입 시각을 변경하면 진입가/BTC 기준가가 새로 계산됩니다.
        </p>
      )}
      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </div>
  );
}
