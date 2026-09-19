'use client';
import { toDateTimeLocal } from '@/lib/date';
import { formatPrice } from '@/lib/format';
import {
  ALL_POINT_LABELS,
  EXTRA_POINT_KEYS,
  POINT_KEYS,
  REQUIRED_POINT_KEYS,
  type AnyPointKey,
  type ParabolicPoint,
  type PointKey,
} from '@/types/parabolic';

interface Props {
  points: Partial<Record<AnyPointKey, ParabolicPoint | null>>;
  activeKey: AnyPointKey;
  onActiveKeyChange: (key: AnyPointKey) => void;
  onManualChange: (key: AnyPointKey, point: ParabolicPoint | null) => void;
}

export default function ParabolicPointsToolbar({ points, activeKey, onActiveKeyChange, onManualChange }: Props) {
  const activePoint = points[activeKey];

  function nextUnsetKey(): PointKey | null {
    for (const k of POINT_KEYS) {
      if (k === 'l4') continue; // optional — never auto-advance onto it
      if (!points[k]) return k;
    }
    return null;
  }

  function handleManualTime(v: string) {
    if (!v) {
      onManualChange(activeKey, null);
      return;
    }
    const time = new Date(v).getTime();
    onManualChange(activeKey, { time, price: activePoint?.price ?? 0 });
  }

  function handleManualPrice(v: string) {
    const price = Number(v);
    if (!activePoint || !Number.isFinite(price)) return;
    onManualChange(activeKey, { ...activePoint, price });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
        {POINT_KEYS.map((key) => {
          const p = points[key];
          const isActive = key === activeKey;
          const required = (REQUIRED_POINT_KEYS as readonly string[]).includes(key);
          return (
            <button
              key={key}
              onClick={() => onActiveKeyChange(key)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 border text-center transition-colors ${
                isActive
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : p
                    ? 'bg-[#111827] border-[#1F2937] text-gray-300 hover:border-[#374151]'
                    : 'bg-[#111827] border-[#1F2937]/60 text-gray-600 hover:border-[#374151]'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide">
                {key}
                {!required && <span className="text-gray-600 font-normal"> (선택)</span>}
              </span>
              <span className="text-[10px] font-mono tabular-nums leading-none">
                {p ? formatPrice(p.price) : '미지정'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Extra shape-context points — independent of the core structure/legs, purely for later comparison */}
      <div className="grid grid-cols-2 gap-1.5">
        {EXTRA_POINT_KEYS.map((key) => {
          const p = points[key];
          const isActive = key === activeKey;
          return (
            <button
              key={key}
              onClick={() => onActiveKeyChange(key)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 border text-center transition-colors ${
                isActive
                  ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                  : p
                    ? 'bg-[#111827] border-purple-900/40 text-gray-300 hover:border-purple-700/60'
                    : 'bg-[#111827] border-[#1F2937]/60 text-gray-600 hover:border-purple-700/60'
              }`}
            >
              <span className="text-[11px] font-bold tracking-wide">{ALL_POINT_LABELS[key]}</span>
              <span className="text-[10px] font-mono tabular-nums leading-none">
                {p ? formatPrice(p.price) : '미지정'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-[#0D1120] border border-[#1F2937] rounded-lg px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">{ALL_POINT_LABELS[activeKey]} 시각</span>
          <input
            type="datetime-local"
            value={activePoint ? toDateTimeLocal(new Date(activePoint.time)) : ''}
            onChange={(e) => handleManualTime(e.target.value)}
            className="bg-[#111827] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">가격</span>
          <input
            type="number"
            step="any"
            value={activePoint?.price ?? ''}
            onChange={(e) => handleManualPrice(e.target.value)}
            placeholder="차트를 클릭하거나 직접 입력"
            disabled={!activePoint}
            className="bg-[#111827] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-1.5 text-sm w-40
                       placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
        </div>
        {activePoint && (
          <button
            onClick={() => onManualChange(activeKey, null)}
            className="text-[11px] text-gray-500 hover:text-red-400 transition-colors pb-2"
          >
            지우기
          </button>
        )}
        {activePoint && (
          <button
            onClick={() => {
              const next = nextUnsetKey();
              if (next) onActiveKeyChange(next);
            }}
            className="ml-auto px-3 py-1.5 rounded-lg bg-[#1F2937] hover:bg-[#2D3748] text-gray-300 text-xs font-semibold transition-colors"
          >
            다음 포인트 →
          </button>
        )}
      </div>
    </div>
  );
}
