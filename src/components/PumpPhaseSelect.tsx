'use client';
import type { PumpPhase } from '@/types/ls';
import { PUMP_PHASE_LABELS } from '@/types/ls';

interface Props {
  value: PumpPhase | null;
  onChange: (v: PumpPhase | null) => void;
  className?: string;
}

/** Plain optional select for the pump-phase field — record-keeping/filtering only, no validation. */
export default function PumpPhaseSelect({ value, onChange, className = '' }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || null) as PumpPhase | null)}
      className={`bg-[#111827] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:border-blue-500 transition-colors ${className}`}
    >
      <option value="">선택 안 함</option>
      {PUMP_PHASE_LABELS.map(({ key, label }) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
