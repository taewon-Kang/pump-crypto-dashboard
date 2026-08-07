'use client';
import { useEffect, useRef } from 'react';
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

interface Props {
  data: MergedData[];
  height?: number;
}

export default function RatioChart({ data, height = 200 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const baselineRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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
      width: containerRef.current.clientWidth,
      height,
    });

    const series = chart.addLineSeries({
      color: '#8B5CF6',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (v: number) => v.toFixed(2) + 'x' },
    });

    // Reference line at ratio = 1
    const baseline = chart.addLineSeries({
      color: 'rgba(107, 114, 128, 0.4)',
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
      if (entries[0]) chart.applyOptions({ width: entries[0].contentRect.width });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current || !baselineRef.current || !data.length) return;

    const lineData: LineData<Time>[] = data
      .filter((d) => d.ratio > 0 && isFinite(d.ratio))
      .map((d) => ({
        time: Math.floor(d.timestamp / 1000) as Time,
        value: d.ratio,
      }));

    seriesRef.current.setData(lineData);

    // Baseline at 1 across entire time range
    if (lineData.length >= 2) {
      baselineRef.current.setData([
        { time: lineData[0].time, value: 1 },
        { time: lineData[lineData.length - 1].time, value: 1 },
      ]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}
