'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts';
import { MergedData } from '@/types';
import type { ChartHandle } from '@/types/chart';

function getPriceFormat(price: number): { type: 'price'; precision: number; minMove: number } {
  if (!price || price <= 0) return { type: 'price', precision: 2, minMove: 0.01 };
  if (price >= 100) return { type: 'price', precision: 2, minMove: 0.01 };
  if (price >= 1) return { type: 'price', precision: 4, minMove: 0.0001 };
  // For sub-1 prices: find significant digit position and show 3+ digits
  const magnitude = Math.abs(Math.floor(Math.log10(price)));
  const precision = Math.min(10, magnitude + 3);
  const minMove = parseFloat(`1e-${precision}`);
  return { type: 'price', precision, minMove };
}

interface Props {
  data: MergedData[];
}

const CandleChart = forwardRef<ChartHandle, Props>(function CandleChart({ data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
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

    const series = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
    if (!seriesRef.current || !data.length) return;

    const latestClose = data[data.length - 1]?.close;
    if (latestClose) {
      seriesRef.current.applyOptions({ priceFormat: getPriceFormat(latestClose) });
    }

    const map = new Map<number, number>();
    const candleData: CandlestickData<Time>[] = data.map((d) => {
      const t = Math.floor(d.timestamp / 1000);
      map.set(t, d.close);
      return { time: t as Time, open: d.open, high: d.high, low: d.low, close: d.close };
    });
    dataMapRef.current = map;

    seriesRef.current.setData(candleData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
});

export default CandleChart;
