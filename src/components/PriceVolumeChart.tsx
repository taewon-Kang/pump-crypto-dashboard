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

function formatLegendTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}

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
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const latestRef = useRef<KlineRaw | null>(null);
  const renderLegendRef = useRef<
    (candle: CandlestickData<Time> | null, volume: number | null, time: Time | null) => void
  >(() => {});

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

    function renderLegend(
      candle: CandlestickData<Time> | null,
      volume: number | null,
      time: Time | null
    ) {
      const el = legendRef.current;
      if (!el) return;
      const c =
        candle ??
        (latestRef.current
          ? {
              open: latestRef.current.open,
              high: latestRef.current.high,
              low: latestRef.current.low,
              close: latestRef.current.close,
            }
          : null);
      const v = volume ?? latestRef.current?.volume ?? null;
      const t =
        time ?? (latestRef.current ? (Math.floor(latestRef.current.timestamp / 1000) as Time) : null);
      if (!c) {
        el.innerHTML = '';
        return;
      }
      const isUp = c.close >= c.open;
      const color = isUp ? '#10B981' : '#EF4444';
      const precision = getPriceFormat(c.close).precision;
      el.innerHTML = `
        <span class="text-gray-500">${t !== null ? formatLegendTime(t as number) : ''}</span>
        <span class="ml-2 text-gray-500">O</span><span style="color:${color}">${c.open.toFixed(precision)}</span>
        <span class="ml-1.5 text-gray-500">H</span><span style="color:${color}">${c.high.toFixed(precision)}</span>
        <span class="ml-1.5 text-gray-500">L</span><span style="color:${color}">${c.low.toFixed(precision)}</span>
        <span class="ml-1.5 text-gray-500">C</span><span style="color:${color}">${c.close.toFixed(precision)}</span>
        <span class="ml-1.5 text-gray-500">Vol</span><span class="text-gray-300">${v !== null ? formatVolume(v) : '-'}</span>
      `;
    }
    renderLegendRef.current = renderLegend;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        renderLegend(null, null, null);
        return;
      }
      const candle = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      const volPoint = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;
      renderLegend(candle ?? null, volPoint ? volPoint.value : null, param.time);
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

    latestRef.current = data[data.length - 1];

    candleRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
    renderLegendRef.current(null, null, null);
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <div
        ref={legendRef}
        className="absolute top-2 left-2.5 z-10 text-[11px] font-mono tabular-nums pointer-events-none whitespace-nowrap"
      />
    </div>
  );
}
