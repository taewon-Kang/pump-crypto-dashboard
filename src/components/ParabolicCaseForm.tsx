'use client';
import { useState } from 'react';
import CoinSelector from '@/components/CoinSelector';
import ParabolicTimeframeSelect from '@/components/ParabolicTimeframeSelect';
import ParabolicChartPicker from '@/components/ParabolicChartPicker';
import ParabolicPointsToolbar from '@/components/ParabolicPointsToolbar';
import {
  POINT_KEYS,
  REQUIRED_POINT_KEYS,
  type ParabolicCaseInput,
  type ParabolicPoint,
  type ParabolicPoints,
  type PointKey,
  type Timeframe,
} from '@/types/parabolic';

const EMPTY_POINTS = { l4: null } as ParabolicPoints;

interface Props {
  onSubmit: (data: ParabolicCaseInput) => Promise<void>;
}

export default function ParabolicCaseForm({ onSubmit }: Props) {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [points, setPoints] = useState<ParabolicPoints>(EMPTY_POINTS);
  const [activeKey, setActiveKey] = useState<PointKey>('l0');
  const [finalTopYn, setFinalTopYn] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function nextUnsetKey(after: PointKey): PointKey | null {
    const startIdx = POINT_KEYS.indexOf(after);
    for (let i = 1; i <= POINT_KEYS.length; i++) {
      const key = POINT_KEYS[(startIdx + i) % POINT_KEYS.length];
      if (key === 'l4') continue;
      if (!points[key]) return key;
    }
    return null;
  }

  function handlePick(key: PointKey, point: ParabolicPoint) {
    setPoints((cur) => {
      const updated = { ...cur, [key]: point };
      return updated;
    });
    if (key === activeKey) {
      const next = nextUnsetKey(key);
      if (next) setActiveKey(next);
    }
  }

  function handleManualChange(key: PointKey, point: ParabolicPoint | null) {
    setPoints((cur) => ({ ...cur, [key]: point }));
  }

  function resetPoints() {
    setPoints(EMPTY_POINTS);
    setActiveKey('l0');
  }

  async function handleSubmit() {
    for (const key of REQUIRED_POINT_KEYS) {
      if (!points[key]) {
        setError('모든 필수 포인트(L0~R1)를 지정해주세요.');
        setActiveKey(key);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ symbol, timeframe, points, finalTopYn, notes: notes.trim() || null });
      resetPoints();
      setFinalTopYn(null);
      setNotes('');
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
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">시간봉</span>
          <ParabolicTimeframeSelect value={timeframe} onChange={setTimeframe} />
        </div>
        <button
          onClick={resetPoints}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors pb-2"
        >
          포인트 초기화
        </button>
      </div>

      <ParabolicChartPicker symbol={symbol} timeframe={timeframe} points={points} activeKey={activeKey} onPick={handlePick} />

      <ParabolicPointsToolbar
        points={points}
        activeKey={activeKey}
        onActiveKeyChange={setActiveKey}
        onManualChange={handleManualChange}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">H3가 최종 고점?</span>
          <div className="flex gap-1 bg-[#0D1120] border border-[#1F2937] rounded-lg p-1">
            {[
              { key: null, label: '미정' },
              { key: true, label: 'Y' },
              { key: false, label: 'N' },
            ].map((opt) => (
              <button
                key={String(opt.key)}
                onClick={() => setFinalTopYn(opt.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  finalTopYn === opt.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 flex-1 min-w-[220px]">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">메모 (바이백/소각/상장/비트 급락 등)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="특이사항 (선택)"
            className="bg-[#0D1120] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-2 text-sm
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
              저장 중...
            </>
          ) : (
            '사례 저장'
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">⚠ {error}</p>}
    </div>
  );
}
