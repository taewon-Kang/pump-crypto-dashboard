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
import { CHART_COLORS, observeChartResize } from '@/lib/chart';
import { formatLegendTime, getPriceFormat } from '@/lib/format';
import { useChartLegend } from '@/hooks/useChartLegend';

interface Props {
  data: MergedData[];
}

const CandleChart = forwardRef<ChartHandle, Props>(function CandleChart({ data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  // Full row per timestamp — doubles as the crosshair-position lookup (close)
  // and the legend data source, so synced charts can render the hovered bar
  // even though lightweight-charts' setCrosshairPosition doesn't itself fire
  // subscribeCrosshairMove on the chart it's applied to.
  const dataMapRef = useRef<Map<number, MergedData>>(new Map());
  const latestRef = useRef<MergedData | null>(null);
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
        const row = dataMapRef.current.get(time as number);
        if (row !== undefined) chart.setCrosshairPosition(row.close, time, series);
      },
      clearCrosshair() {
        chartRef.current?.clearCrosshairPosition();
      },
      showLegendAt(time: Time | null) {
        const row = time !== null ? dataMapRef.current.get(time as number) : undefined;
        setHtml(legendHtml(row ?? null, time));
      },
    }),
    [setHtml]
  );

  function legendHtml(
    candle: { open: number; high: number; low: number; close: number } | null,
    time: Time | null
  ): string {
    const c = candle ?? latestRef.current;
    if (!c) return '';
    const t = time ?? (latestRef.current ? Math.floor(latestRef.current.timestamp / 1000) : null);
    const color = c.close >= c.open ? CHART_COLORS.up : CHART_COLORS.down;
    const precision = getPriceFormat(c.close).precision;
    return `
      <span class="text-gray-500">${t !== null ? formatLegendTime(t as number) : ''}</span>
      <span class="ml-2 text-gray-500">O</span><span style="color:${color}">${c.open.toFixed(precision)}</span>
      <span class="ml-1.5 text-gray-500">H</span><span style="color:${color}">${c.high.toFixed(precision)}</span>
      <span class="ml-1.5 text-gray-500">L</span><span style="color:${color}">${c.low.toFixed(precision)}</span>
      <span class="ml-1.5 text-gray-500">C</span><span style="color:${color}">${c.close.toFixed(precision)}</span>
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

    const series = chart.addCandlestickSeries({
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    attach(chart, (param) => {
      const candle = param ? (param.seriesData.get(series) as CandlestickData<Time> | undefined) : undefined;
      return legendHtml(candle ?? null, param?.time ?? null);
    });

    const cleanupResize = observeChartResize(containerRef.current, chart);

    return () => {
      cleanupResize();
      chart.remove();
    };
  }, [attach]);

  useEffect(() => {
    if (!seriesRef.current || !data.length) return;

    const latestClose = data[data.length - 1]?.close;
    if (latestClose) {
      seriesRef.current.applyOptions({ priceFormat: getPriceFormat(latestClose) });
    }

    const map = new Map<number, MergedData>();
    const candleData: CandlestickData<Time>[] = data.map((d) => {
      const t = Math.floor(d.timestamp / 1000);
      map.set(t, d);
      return { time: t as Time, open: d.open, high: d.high, low: d.low, close: d.close };
    });
    dataMapRef.current = map;
    latestRef.current = data[data.length - 1];

    seriesRef.current.setData(candleData);
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

export default CandleChart;
