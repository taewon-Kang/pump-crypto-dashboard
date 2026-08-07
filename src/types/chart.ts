import type { IChartApi, Time } from 'lightweight-charts';

export interface ChartHandle {
  chart: IChartApi;
  syncCrosshair: (time: Time) => void;
  clearCrosshair: () => void;
}
