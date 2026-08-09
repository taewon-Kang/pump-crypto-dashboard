import type { IChartApi, Time } from 'lightweight-charts';

export interface ChartHandle {
  chart: IChartApi;
  syncCrosshair: (time: Time) => void;
  clearCrosshair: () => void;
  /** Updates this chart's own hover legend to the value at `time` (or the latest value when null). */
  showLegendAt: (time: Time | null) => void;
}
