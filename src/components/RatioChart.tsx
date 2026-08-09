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

function formatLegendTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  data: MergedData[];
}

const RatioChart = forwardRef<ChartHandle, Props>(function RatioChart({ data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const baselineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dataMapRef = useRef<Map<number, number>>(new Map());
  const latestRef = useRef<{ time: number; ratio: number } | null>(null);
  const renderLegendRef = useRef<(value: number | null, time: Time | null) => void>(() => {});

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
    }),
    []
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: {
        borderColor: '#374151',
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

    function renderLegend(value: number | null, time: Time | null) {
      const el = legendRef.current;
      if (!el) return;
      const v = value ?? latestRef.current?.ratio ?? null;
      const t = time ?? (latestRef.current ? (latestRef.current.time as Time) : null);
      if (v === null) {
        el.innerHTML = '';
        return;
      }
      const color = v >= 1 ? '#8B5CF6' : '#6B7280';
      el.innerHTML = `
        <span class="text-gray-500">${t !== null ? formatLegendTime(t as number) : ''}</span>
        <span class="ml-2 text-gray-500">Ratio</span>
        <span style="color:${color}">${v.toFixed(2)}x</span>
      `;
    }
    renderLegendRef.current = renderLegend;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        renderLegend(null, null);
        return;
      }
      const point = param.seriesData.get(series) as LineData<Time> | undefined;
      renderLegend(point ? point.value : null, param.time);
    });

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, []);

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
    renderLegendRef.current(null, null);
  }, [data]);

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
