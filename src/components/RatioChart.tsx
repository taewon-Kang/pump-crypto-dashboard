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

interface Props {
  data: MergedData[];
}

const RatioChart = forwardRef<ChartHandle, Props>(function RatioChart({ data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const baselineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dataMapRef = useRef<Map<number, number>>(new Map());

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

    seriesRef.current.setData(lineData);

    if (lineData.length >= 2) {
      baselineRef.current.setData([
        { time: lineData[0].time, value: 1 },
        { time: lineData[lineData.length - 1].time, value: 1 },
      ]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default RatioChart;
