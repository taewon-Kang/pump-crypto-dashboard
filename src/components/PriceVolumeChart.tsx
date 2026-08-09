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
import { CHART_COLORS, observeChartResize } from '@/lib/chart';
import { formatLegendTime, formatVolume, getPriceFormat } from '@/lib/format';
import { useChartLegend } from '@/hooks/useChartLegend';

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
  const latestRef = useRef<KlineRaw | null>(null);
  const { legendRef, setHtml, attach } = useChartLegend();

  function legendHtml(candle: CandlestickData<Time> | null, volume: number | null, time: Time | null): string {
    const c = candle ?? latestRef.current;
    if (!c) return '';
    const v = volume ?? latestRef.current?.volume ?? null;
    const t = time ?? (latestRef.current ? (Math.floor(latestRef.current.timestamp / 1000) as Time) : null);
    const color = c.close >= c.open ? CHART_COLORS.up : CHART_COLORS.down;
    const precision = getPriceFormat(c.close).precision;
    return `
      <span class="text-gray-500">${t !== null ? formatLegendTime(t as number) : ''}</span>
      <span class="ml-2 text-gray-500">O</span><span style="color:${color}">${c.open.toFixed(precision)}</span>
      <span class="ml-1.5 text-gray-500">H</span><span style="color:${color}">${c.high.toFixed(precision)}</span>
      <span class="ml-1.5 text-gray-500">L</span><span style="color:${color}">${c.low.toFixed(precision)}</span>
      <span class="ml-1.5 text-gray-500">C</span><span style="color:${color}">${c.close.toFixed(precision)}</span>
      <span class="ml-1.5 text-gray-500">Vol</span><span class="text-gray-300">${v !== null ? formatVolume(v) : '-'}</span>
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
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      width: clientWidth,
      height: clientHeight,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
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

    attach(chart, (param) => {
      const candle = param ? (param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined) : undefined;
      const volPoint = param ? (param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined) : undefined;
      return legendHtml(candle ?? null, volPoint ? volPoint.value : null, param?.time ?? null);
    });

    const cleanupResize = observeChartResize(containerRef.current, chart);

    return () => {
      cleanupResize();
      chart.remove();
    };
  }, [attach]);

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
    setHtml(legendHtml(null, null, null));
  }, [data, setHtml]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <div
        ref={legendRef}
        className="absolute top-2 left-2.5 z-10 text-[11px] font-mono tabular-nums pointer-events-none whitespace-nowrap"
      />
    </div>
  );
}
