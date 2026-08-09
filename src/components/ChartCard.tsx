'use client';
import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  badge?: ReactNode;
  indicator?: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, badge, indicator, children, className }: Props) {
  return (
    <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden">
      <div className="px-4 py-2 border-b border-[#1F2937] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {indicator && <span className={`w-2 h-2 rounded-full shrink-0 ${indicator}`} />}
          <span className="text-sm font-medium text-gray-200 truncate">{title}</span>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <div className={`relative ${className ?? ''}`}>{children}</div>
    </div>
  );
}
