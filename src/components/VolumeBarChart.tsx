'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type HistogramData,
  type Time,
} from 'lightweight-charts';
import { MergedData } from '@/types';
import type { ChartHandle } from '@/types/chart';

interface Props {
  data: MergedData[];
}

const VolumeBarChart = forwardRef<ChartHandle, Props>(function VolumeBarChart({ data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const spotRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const futuresRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  // Use futures series (on top) for crosshair sync
  const dataMapRef = useRef<Map<number, number>>(new Map());

  useImperativeHandle(
    ref,
    () => ({
      get chart() {
        return chartRef.current!;
      },
      syncCrosshair(time: Time) {
        const chart = chartRef.current;
        const series = futuresRef.current;
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
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
      width: clientWidth,
      height: clientHeight,
    });

    // Spot rendered first (behind), futures on top
    const spotSeries = chart.addHistogramSeries({
      color: 'rgba(59, 130, 246, 0.75)',
      priceFormat: { type: 'volume' },
    });

    const futuresSeries = chart.addHistogramSeries({
      color: 'rgba(249, 115, 22, 0.75)',
      priceFormat: { type: 'volume' },
    });

    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 },
    });

    chartRef.current = chart;
    spotRef.current = spotSeries;
    futuresRef.current = futuresSeries;

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
    if (!spotRef.current || !futuresRef.current || !data.length) return;

    const map = new Map<number, number>();
    const spotData: HistogramData<Time>[] = [];
    const futuresData: HistogramData<Time>[] = [];

    for (const d of data) {
      const t = Math.floor(d.timestamp / 1000) as Time;
      map.set(t as number, d.futuresVolume);
      spotData.push({ time: t, value: d.spotVolume });
      futuresData.push({ time: t, value: d.futuresVolume });
    }
    dataMapRef.current = map;

    spotRef.current.setData(spotData);
    futuresRef.current.setData(futuresData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default VolumeBarChart;
