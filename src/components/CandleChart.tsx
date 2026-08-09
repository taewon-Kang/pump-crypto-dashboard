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

function formatLegendTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const dataMapRef = useRef<Map<number, number>>(new Map());
  const latestRef = useRef<MergedData | null>(null);
  const renderLegendRef = useRef<(candle: CandlestickData<Time> | null, time: Time | null) => void>(() => {});

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

    function renderLegend(candle: CandlestickData<Time> | null, time: Time | null) {
      const el = legendRef.current;
      if (!el) return;
      const c = candle ?? latestRef.current;
      if (!c) {
        el.innerHTML = '';
        return;
      }
      const t = time ?? (latestRef.current ? Math.floor(latestRef.current.timestamp / 1000) : null);
      const isUp = c.close >= c.open;
      const color = isUp ? '#10B981' : '#EF4444';
      el.innerHTML = `
        <span class="text-gray-500">${t !== null ? formatLegendTime(t as number) : ''}</span>
        <span class="ml-2 text-gray-500">O</span><span style="color:${color}">${c.open.toFixed(getPriceFormat(c.close).precision)}</span>
        <span class="ml-1.5 text-gray-500">H</span><span style="color:${color}">${c.high.toFixed(getPriceFormat(c.close).precision)}</span>
        <span class="ml-1.5 text-gray-500">L</span><span style="color:${color}">${c.low.toFixed(getPriceFormat(c.close).precision)}</span>
        <span class="ml-1.5 text-gray-500">C</span><span style="color:${color}">${c.close.toFixed(getPriceFormat(c.close).precision)}</span>
      `;
    }
    renderLegendRef.current = renderLegend;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        renderLegend(null, null);
        return;
      }
      const candle = param.seriesData.get(series) as CandlestickData<Time> | undefined;
      renderLegend(candle ?? null, param.time);
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
    latestRef.current = data[data.length - 1];

    seriesRef.current.setData(candleData);
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

export default CandleChart;
