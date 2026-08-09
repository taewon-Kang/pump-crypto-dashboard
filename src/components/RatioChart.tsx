'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from 'lightweight-charts';
import { MergedData } from '@/types';
import type { ChartHandle } from '@/types/chart';
import { CHART_COLORS, observeChartResize } from '@/lib/chart';
import { formatLegendTime } from '@/lib/format';
import { useChartLegend } from '@/hooks/useChartLegend';

interface Props {
  data: MergedData[];
}

const RatioChart = forwardRef<ChartHandle, Props>(function RatioChart({ data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const baselineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dataMapRef = useRef<Map<number, number>>(new Map());
  const latestRef = useRef<{ time: number; ratio: number } | null>(null);
  const { legendRef, setHtml, attach } = useChartLegend();

  useImperativeHandle(
    ref,
    () => ({
      get chart() {
        return chartRef.current!;
      },
      syncCrosshair(time: Time) {
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series) return;
        const value = dataMapRef.current.get(time as number);
        if (value !== undefined) chart.setCrosshairPosition(value, time, series);
      },
      clearCrosshair() {
        chartRef.current?.clearCrosshairPosition();
      },
      showLegendAt(time: Time | null) {
        const value = time !== null ? dataMapRef.current.get(time as number) ?? null : null;
        setHtml(legendHtml(value, time));
      },
    }),
    [setHtml]
  );

  function legendHtml(value: number | null, time: Time | null): string {
    const v = value ?? latestRef.current?.ratio ?? null;
    if (v === null) return '';
    const t = time ?? (latestRef.current ? (latestRef.current.time as Time) : null);
    const color = v >= 1 ? '#8B5CF6' : '#6B7280';
    return `
      <span class="text-gray-500">${t !== null ? formatLegendTime(t as number) : ''}</span>
      <span class="ml-2 text-gray-500">Ratio</span>
      <span style="color:${color}">${v.toFixed(2)}x</span>
    `;
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART_COLORS.border },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      width: clientWidth,
      height: clientHeight,
    });

    const series = chart.addLineSeries({
      color: '#8B5CF6',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) + 'x' },
    });

    const baseline = chart.addLineSeries({
      color: 'rgba(107, 114, 128, 0.35)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    baselineRef.current = baseline;

    attach(chart, (param) => {
      const point = param ? (param.seriesData.get(series) as LineData<Time> | undefined) : undefined;
      return legendHtml(point ? point.value : null, param?.time ?? null);
    });

    const cleanupResize = observeChartResize(containerRef.current, chart);

    return () => {
      cleanupResize();
      chart.remove();
    };
  }, [attach]);

  useEffect(() => {
    if (!seriesRef.current || !baselineRef.current || !data.length) return;

    const map = new Map<number, number>();
    const lineData: LineData<Time>[] = [];

    for (const d of data) {
      if (d.ratio > 0 && isFinite(d.ratio)) {
        const t = Math.floor(d.timestamp / 1000);
        map.set(t, d.ratio);
        lineData.push({ time: t as Time, value: d.ratio });
      }
    }
    dataMapRef.current = map;
    if (lineData.length) {
      const last = lineData[lineData.length - 1];
      latestRef.current = { time: last.time as number, ratio: last.value };
    }

    seriesRef.current.setData(lineData);

    if (lineData.length >= 2) {
      baselineRef.current.setData([
        { time: lineData[0].time, value: 1 },
        { time: lineData[lineData.length - 1].time, value: 1 },
      ]);
    }

    chartRef.current?.timeScale().fitContent();
    setHtml(legendHtml(null, null));
  }, [data, setHtml]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <div
        ref={legendRef}
        className="absolute top-2 left-2.5 z-10 text-[11px] font-mono tabular-nums pointer-events-none whitespace-nowrap"
      />
    </div>
  );
});

export default RatioChart;
