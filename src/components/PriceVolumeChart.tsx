'use client';
import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts';
import type { KlineRaw } from '@/types';

function getPriceFormat(price: number): { type: 'price'; precision: number; minMove: number } {
  if (!price || price <= 0) return { type: 'price', precision: 2, minMove: 0.01 };
  if (price >= 100) return { type: 'price', precision: 2, minMove: 0.01 };
  if (price >= 1) return { type: 'price', precision: 4, minMove: 0.0001 };
  // Sub-1 prices: find significant digit position and show 3+ digits
  const magnitude = Math.abs(Math.floor(Math.log10(price)));
  const precision = Math.min(10, magnitude + 3);
  const minMove = parseFloat(`1e-${precision}`);
  return { type: 'price', precision, minMove };
}

interface Props {
  data: KlineRaw[];
}

/**
 * Single-panel candlestick + volume histogram chart, sharing one time axis.
 * The volume series is pinned to its own price scale compressed into the
 * bottom of the panel, TradingView-style, so both series render together.
 */
export default function PriceVolumeChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
      width: clientWidth,
      height: clientHeight,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
      priceScaleId: 'right',
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

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
    if (!candleRef.current || !volumeRef.current || !data.length) return;

    const latestClose = data[data.length - 1]?.close;
    if (latestClose) {
      candleRef.current.applyOptions({ priceFormat: getPriceFormat(latestClose) });
    }

    const candleData: CandlestickData<Time>[] = [];
    const volumeData: HistogramData<Time>[] = [];

    for (const d of data) {
      const t = Math.floor(d.timestamp / 1000) as Time;
      candleData.push({ time: t, open: d.open, high: d.high, low: d.low, close: d.close });
      volumeData.push({
        time: t,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
      });
    }

    candleRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
}
