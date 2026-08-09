'use client';
import { useState, useRef, useEffect } from 'react';
import type { LogicalRange, MouseEventParams, Time } from 'lightweight-charts';
import { useMarketData } from '@/hooks/useMarketData';
import { INTERVAL_OPTIONS, type Interval } from '@/types';
import type { ChartHandle } from '@/types/chart';
import CoinSelector from '@/components/CoinSelector';
import CandleChart from '@/components/CandleChart';
import RatioChart from '@/components/RatioChart';
import VolumeBarChart from '@/components/VolumeBarChart';
import ChartCard from '@/components/ChartCard';
import LoadingOverlay from '@/components/LoadingOverlay';
import { formatPrice, formatVolume } from '@/lib/format';

export default function HomePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState<Interval>('1d');
  const { data, loading, error } = useMarketData(symbol, interval);

  const candleRef = useRef<ChartHandle>(null);
  const ratioRef = useRef<ChartHandle>(null);
  const volumeRef = useRef<ChartHandle>(null);
  const isSyncingRef = useRef(false);

  // Set up cross-chart sync whenever data is ready
  useEffect(() => {
    if (!data.length) return;

    // Wait one tick for charts to finish rendering data
    const timer = setTimeout(() => {
      const handles = [candleRef.current, ratioRef.current, volumeRef.current];
      if (!handles.every(Boolean)) return;

      const cleanups: (() => void)[] = [];

      handles.forEach((source, srcIdx) => {
        if (!source) return;
        const others = handles.filter((_, i) => i !== srcIdx) as ChartHandle[];

        // ── Zoom / Pan sync ──────────────────────────────────────────────
        const rangeHandler = (range: LogicalRange | null) => {
          if (isSyncingRef.current || !range) return;
          isSyncingRef.current = true;
          others.forEach((h) => h.chart.timeScale().setVisibleLogicalRange(range));
          isSyncingRef.current = false;
        };
        source.chart.timeScale().subscribeVisibleLogicalRangeChange(rangeHandler);
        cleanups.push(() =>
          source.chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeHandler)
        );

        // ── Crosshair sync ───────────────────────────────────────────────
        const crosshairHandler = (param: MouseEventParams<Time>) => {
          if (isSyncingRef.current) return;
          isSyncingRef.current = true;
          others.forEach((h) => {
            if (param.time) {
              h.syncCrosshair(param.time);
              h.showLegendAt(param.time);
            } else {
              h.clearCrosshair();
              h.showLegendAt(null);
            }
          });
          isSyncingRef.current = false;
        };
        source.chart.subscribeCrosshairMove(crosshairHandler);
        cleanups.push(() => source.chart.unsubscribeCrosshairMove(crosshairHandler));
      });

      return () => cleanups.forEach((fn) => fn());
    }, 50);

    return () => clearTimeout(timer);
  }, [data]);

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const priceChange =
    latest && prev ? ((latest.close - prev.close) / prev.close) * 100 : null;

  return (
    <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-2 sm:py-3 space-y-2 sm:space-y-3">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <CoinSelector value={symbol} onChange={setSymbol} />
          {latest && (
            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-bold tabular-nums font-mono">
                {formatPrice(latest.close)}
              </span>
              {priceChange !== null && (
                <span
                  className={`text-sm font-medium ${
                    priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {priceChange >= 0 ? '+' : ''}
                  {priceChange.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex sm:ml-auto">
          <div className="flex gap-1 bg-[#111827] border border-[#1F2937] rounded-lg p-1">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  interval === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Price Chart */}
      <ChartCard
        title={`${symbol.replace('USDT', '/USDT')} Price`}
        indicator="bg-blue-400"
        badge={
          priceChange !== null ? (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                priceChange >= 0
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-red-900/40 text-red-400'
              }`}
            >
              {priceChange >= 0 ? '+' : ''}
              {priceChange.toFixed(2)}%
            </span>
          ) : null
        }
      >
        <div className="h-[165px] sm:h-[210px] lg:h-[260px] relative">
          {loading ? <LoadingOverlay /> : <CandleChart ref={candleRef} data={data} />}
        </div>
      </ChartCard>

      {/* Ratio Chart */}
      <ChartCard
        title="Futures / Spot Volume Ratio"
        indicator="bg-violet-400"
        badge={
          latest ? (
            <span className="text-sm font-bold text-violet-400 tabular-nums font-mono">
              {latest.ratio.toFixed(2)}x
            </span>
          ) : null
        }
      >
        <div className="h-[80px] sm:h-[105px] lg:h-[120px] relative">
          {loading ? <LoadingOverlay /> : <RatioChart ref={ratioRef} data={data} />}
        </div>
      </ChartCard>

      {/* Volume Comparison Chart */}
      <ChartCard
        title="Spot vs Futures Volume"
        indicator="bg-orange-400"
        badge={
          latest ? (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/80 inline-block" />
                <span className="text-gray-400 hidden sm:inline">Spot</span>
                <span className="text-blue-400 font-semibold">{formatVolume(latest.spotVolume)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-500/80 inline-block" />
                <span className="text-gray-400 hidden sm:inline">Futures</span>
                <span className="text-orange-400 font-semibold">{formatVolume(latest.futuresVolume)}</span>
              </div>
            </div>
          ) : null
        }
      >
        <div className="h-[100px] sm:h-[135px] lg:h-[160px] relative">
          {loading ? <LoadingOverlay /> : <VolumeBarChart ref={volumeRef} data={data} />}
        </div>
      </ChartCard>

    </main>
  );
}
