'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, type IChartApi, type ISeriesApi, type CandlestickData, type SeriesMarker, type Time } from 'lightweight-charts';
import type { KlineRaw } from '@/types';
import { CHART_COLORS, observeChartResize } from '@/lib/chart';
import { getPriceFormat, formatLegendTime } from '@/lib/format';
import { POINT_KEYS, POINT_LABELS, type ParabolicPoints, type PointKey } from '@/types/parabolic';

const HIGH_KEYS = new Set<PointKey>(['h1', 'h2', 'h3', 'r1']);

interface Props {
  symbol: string;
  timeframe: string;
  points: ParabolicPoints;
  activeKey: PointKey;
  onPick: (key: PointKey, point: { time: number; price: number }) => void;
}

/**
 * Candlestick chart for laying out a parabolic-pump structure by clicking
 * candles instead of typing timestamps. Clicking snaps to the clicked
 * candle's high (for a peak point) or low (for a trough point), and the
 * placed points render as markers so the whole structure stays visible
 * while marking it.
 */
export default function ParabolicChartPicker({ symbol, timeframe, points, activeKey, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const dataMapRef = useRef<Map<number, KlineRaw>>(new Map());
  const activeKeyRef = useRef(activeKey);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    activeKeyRef.current = activeKey;
    onPickRef.current = onPick;
  }, [activeKey, onPick]);

  const [candles, setCandles] = useState<KlineRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);

  // Loads the coin's full futures kline history for this timeframe (paginated
  // back to its earliest listed candle), same as the home Volume Gap chart —
  // not just the most recent page — so old structures aren't cut off.
  const load = useCallback(async (sym: string, tf: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parabolic/klines?${new URLSearchParams({ symbol: sym, interval: tf })}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: KlineRaw[] = await res.json();
      setCandles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '캔들 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(symbol, timeframe);
  }, [symbol, timeframe, load]);

  // Chart lifecycle — created once per mount.
  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: CHART_COLORS.background }, textColor: CHART_COLORS.text },
      grid: { vertLines: { color: CHART_COLORS.grid }, horzLines: { color: CHART_COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: CHART_COLORS.border },
      timeScale: { borderColor: CHART_COLORS.border, timeVisible: true, secondsVisible: false },
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

    const clickHandler = (param: { time?: Time }) => {
      if (param.time === undefined) return;
      const candle = dataMapRef.current.get(param.time as number);
      if (!candle) return;
      const key = activeKeyRef.current;
      const price = HIGH_KEYS.has(key) ? candle.high : candle.low;
      onPickRef.current(key, { time: candle.timestamp, price });
    };
    chart.subscribeClick(clickHandler);

    const moveHandler = (param: { time?: Time }) => {
      if (param.time === undefined) {
        setHoverInfo(null);
        return;
      }
      const candle = dataMapRef.current.get(param.time as number);
      if (!candle) {
        setHoverInfo(null);
        return;
      }
      const precision = getPriceFormat(candle.close).precision;
      setHoverInfo(
        `${formatLegendTime(Math.floor(candle.timestamp / 1000))}  H ${candle.high.toFixed(precision)}  L ${candle.low.toFixed(precision)}`
      );
    };
    chart.subscribeCrosshairMove(moveHandler);

    const cleanupResize = observeChartResize(containerRef.current, chart);

    return () => {
      chart.unsubscribeClick(clickHandler);
      chart.unsubscribeCrosshairMove(moveHandler);
      cleanupResize();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Data updates.
  useEffect(() => {
    if (!seriesRef.current || !candles.length) return;

    const latestClose = candles[candles.length - 1]?.close;
    if (latestClose) seriesRef.current.applyOptions({ priceFormat: getPriceFormat(latestClose) });

    const map = new Map<number, KlineRaw>();
    const candleData: CandlestickData<Time>[] = candles.map((c) => {
      const t = Math.floor(c.timestamp / 1000);
      map.set(t, c);
      return { time: t as Time, open: c.open, high: c.high, low: c.low, close: c.close };
    });
    dataMapRef.current = map;
    seriesRef.current.setData(candleData);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Marker updates — one per placed point, so the whole structure stays visible while marking it.
  useEffect(() => {
    if (!seriesRef.current) return;
    const markers: SeriesMarker<Time>[] = [];
    for (const key of POINT_KEYS) {
      const p = points[key];
      if (!p) continue;
      const t = Math.floor(p.time / 1000);
      if (!dataMapRef.current.has(t)) continue; // not a bar on the currently-loaded/timeframe series
      const isHigh = HIGH_KEYS.has(key);
      markers.push({
        time: t as Time,
        position: isHigh ? 'aboveBar' : 'belowBar',
        color: key === activeKey ? '#3B82F6' : isHigh ? CHART_COLORS.down : CHART_COLORS.up,
        shape: isHigh ? 'arrowDown' : 'arrowUp',
        text: key.toUpperCase(),
      });
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    seriesRef.current.setMarkers(markers);
  }, [points, activeKey, candles]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[11px] text-gray-500">
          <span className="text-blue-400 font-semibold">{POINT_LABELS[activeKey]}</span> 지정 중 — 캔들을 클릭하면{' '}
          {HIGH_KEYS.has(activeKey) ? '고가' : '저가'}로 자동 입력됩니다
        </span>
        {candles.length > 0 && (
          <span className="text-[11px] text-gray-600 shrink-0">
            {formatLegendTime(Math.floor(candles[0].timestamp / 1000))} ~ (스크롤로 확대/이동)
          </span>
        )}
      </div>
      <div className="relative w-full h-[420px] bg-[#111827] rounded-lg border border-[#1F2937] overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />
        {hoverInfo && (
          <div className="absolute top-2 left-2.5 z-10 text-[11px] font-mono tabular-nums text-gray-400 pointer-events-none">
            {hoverInfo}
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 bg-[#111827]/70">
            전체 차트 기록을 불러오는 중...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 bg-[#111827]/70 px-4 text-center">
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}
