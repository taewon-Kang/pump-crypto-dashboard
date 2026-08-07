'use client';
import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type HistogramData,
  type Time,
} from 'lightweight-charts';
import { MergedData } from '@/types';

interface Props {
  data: MergedData[];
}

export default function VolumeBarChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const spotRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const futuresRef = useRef<ISeriesApi<'Histogram'> | null>(null);

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

    const spotData: HistogramData<Time>[] = data.map((d) => ({
      time: Math.floor(d.timestamp / 1000) as Time,
      value: d.spotVolume,
    }));

    const futuresData: HistogramData<Time>[] = data.map((d) => ({
      time: Math.floor(d.timestamp / 1000) as Time,
      value: d.futuresVolume,
    }));

    spotRef.current.setData(spotData);
    futuresRef.current.setData(futuresData);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return <div ref={containerRef} className="w-full h-full" />;
}
