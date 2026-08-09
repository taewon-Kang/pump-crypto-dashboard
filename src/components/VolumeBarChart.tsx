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
import { CHART_COLORS, observeChartResize } from '@/lib/chart';
import { formatLegendTime, formatVolume } from '@/lib/format';
import { useChartLegend } from '@/hooks/useChartLegend';

interface Props {
  data: MergedData[];
}

const VolumeBarChart = forwardRef<ChartHandle, Props>(function VolumeBarChart({ data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const spotRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const futuresRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  // Full row per timestamp — used for crosshair positioning (futures series,
  // shown on top) and for the legend, since synced charts need to render the
  // hovered bar even though setCrosshairPosition doesn't fire their own
  // subscribeCrosshairMove.
  const dataMapRef = useRef<Map<number, MergedData>>(new Map());
  const latestRef = useRef<{ time: number; spot: number; futures: number } | null>(null);
  const { legendRef, setHtml, attach } = useChartLegend();

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
        const row = dataMapRef.current.get(time as number);
        if (row !== undefined) chart.setCrosshairPosition(row.futuresVolume, time, series);
      },
      clearCrosshair() {
        chartRef.current?.clearCrosshairPosition();
      },
      showLegendAt(time: Time | null) {
        const row = time !== null ? dataMapRef.current.get(time as number) : undefined;
        setHtml(legendHtml(row?.spotVolume ?? null, row?.futuresVolume ?? null, time));
      },
    }),
    [setHtml]
  );

  function legendHtml(spot: number | null, futures: number | null, time: Time | null): string {
    const s = spot ?? latestRef.current?.spot ?? null;
    const f = futures ?? latestRef.current?.futures ?? null;
    if (s === null && f === null) return '';
    const t = time ?? (latestRef.current ? (latestRef.current.time as Time) : null);
    return `
      <span class="text-gray-500">${t !== null ? formatLegendTime(t as number) : ''}</span>
      <span class="ml-2 text-gray-500">Spot</span>
      <span style="color:#60A5FA">${s !== null ? formatVolume(s) : '-'}</span>
      <span class="ml-1.5 text-gray-500">Futures</span>
      <span style="color:#FB923C">${f !== null ? formatVolume(f) : '-'}</span>
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
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      width: clientWidth,
      height: clientHeight,
    });

    // Futures rendered first (behind), spot on top
    // Draw order matters: orange(futures) + blue(spot) → purple overlap, not skin-tone
    const futuresSeries = chart.addHistogramSeries({
      color: 'rgba(249, 115, 22, 0.9)',
      priceFormat: { type: 'volume' },
    });

    const spotSeries = chart.addHistogramSeries({
      color: 'rgba(59, 130, 246, 0.62)',
      priceFormat: { type: 'volume' },
    });

    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.1, bottom: 0 },
    });

    chartRef.current = chart;
    spotRef.current = spotSeries;
    futuresRef.current = futuresSeries;

    attach(chart, (param) => {
      const spotPoint = param ? (param.seriesData.get(spotSeries) as HistogramData<Time> | undefined) : undefined;
      const futuresPoint = param
        ? (param.seriesData.get(futuresSeries) as HistogramData<Time> | undefined)
        : undefined;
      return legendHtml(spotPoint ? spotPoint.value : null, futuresPoint ? futuresPoint.value : null, param?.time ?? null);
    });

    const cleanupResize = observeChartResize(containerRef.current, chart);

    return () => {
      cleanupResize();
      chart.remove();
    };
  }, [attach]);

  useEffect(() => {
    if (!spotRef.current || !futuresRef.current || !data.length) return;

    const map = new Map<number, MergedData>();
    const spotData: HistogramData<Time>[] = [];
    const futuresData: HistogramData<Time>[] = [];

    for (const d of data) {
      const t = Math.floor(d.timestamp / 1000) as Time;
      map.set(t as number, d);
      spotData.push({ time: t, value: d.spotVolume });
      futuresData.push({ time: t, value: d.futuresVolume });
    }
    dataMapRef.current = map;
    const lastRow = data[data.length - 1];
    if (lastRow) {
      latestRef.current = {
        time: Math.floor(lastRow.timestamp / 1000),
        spot: lastRow.spotVolume,
        futures: lastRow.futuresVolume,
      };
    }

    spotRef.current.setData(spotData);
    futuresRef.current.setData(futuresData);
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
});

export default VolumeBarChart;
