import type { IChartApi } from 'lightweight-charts';

/** Shared dark-theme palette for every lightweight-charts instance in the app. */
export const CHART_COLORS = {
  background: '#111827',
  text: '#9CA3AF',
  grid: '#1F2937',
  border: '#374151',
  up: '#10B981',
  down: '#EF4444',
} as const;

/** Keeps a chart's pixel size in sync with its container. Returns a cleanup function. */
export function observeChartResize(container: HTMLElement, chart: IChartApi): () => void {
  const observer = new ResizeObserver((entries) => {
    if (entries[0]) {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    }
  });
  observer.observe(container);
  return () => observer.disconnect();
}
