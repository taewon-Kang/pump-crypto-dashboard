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

interface Props {
  data: MergedData[];
}

const VolumeBarChart = forwardRef<ChartHandle, Props>(function VolumeBarChart({ data }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const spotRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const futuresRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  // Use futures series (on top) for crosshair sync
  const dataMapRef = useRef<Map<number, number>>(new Map());
  const latestRef = useRef<{ time: number; spot: number; futures: number } | null>(null);
  const renderLegendRef =
    useRef<(spot: number | null, futures: number | null, time: Time | null) => void>(() => {});

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

    function renderLegend(spot: number | null, futures: number | null, time: Time | null) {
      const el = legendRef.current;
      if (!el) return;
      const s = spot ?? latestRef.current?.spot ?? null;
      const f = futures ?? latestRef.current?.futures ?? null;
      const t = time ?? (latestRef.current ? (latestRef.current.time as Time) : null);
      if (s === null && f === null) {
        el.innerHTML = '';
        return;
      }
      el.innerHTML = `
        <span class="text-gray-500">${t !== null ? formatLegendTime(t as number) : ''}</span>
        <span class="ml-2 text-gray-500">Spot</span>
        <span style="color:#60A5FA">${s !== null ? formatVolume(s) : '-'}</span>
        <span class="ml-1.5 text-gray-500">Futures</span>
        <span style="color:#FB923C">${f !== null ? formatVolume(f) : '-'}</span>
      `;
    }
    renderLegendRef.current = renderLegend;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        renderLegend(null, null, null);
        return;
      }
      const spotPoint = param.seriesData.get(spotSeries) as HistogramData<Time> | undefined;
      const futuresPoint = param.seriesData.get(futuresSeries) as HistogramData<Time> | undefined;
      renderLegend(spotPoint ? spotPoint.value : null, futuresPoint ? futuresPoint.value : null, param.time);
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
});

export default VolumeBarChart;
