'use client';
import LoadingDots from '@/components/LoadingDots';

/** Full-bleed loading spinner for a chart (or other) container mid-fetch. */
export default function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#111827]">
      <LoadingDots />
    </div>
  );
}
