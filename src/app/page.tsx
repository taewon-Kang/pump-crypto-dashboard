'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useMarketData } from '@/hooks/useMarketData';
import { INTERVAL_OPTIONS, type Interval } from '@/types';
import CoinSelector from '@/components/CoinSelector';

const CandleChart = dynamic(() => import('@/components/CandleChart'), { ssr: false });
const RatioChart = dynamic(() => import('@/components/RatioChart'), { ssr: false });
const VolumeBarChart = dynamic(() => import('@/components/VolumeBarChart'), { ssr: false });

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}

function formatPrice(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LoadingBounce() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  badge?: React.ReactNode;
  indicator?: string;
  children: React.ReactNode;
  className?: string;
}

function ChartCard({ title, badge, indicator, children, className }: ChartCardProps) {
  return (
    <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {indicator && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${indicator}`} />
          )}
          <span className="text-sm font-medium text-gray-200 truncate">{title}</span>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <div className={`relative p-2 ${className ?? ''}`}>{children}</div>
    </div>
  );
}

export default function HomePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState<Interval>('4h');
  const { data, loading, error } = useMarketData(symbol, interval);

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const priceChange =
    latest && prev ? ((latest.close - prev.close) / prev.close) * 100 : null;

  return (
    <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Left: Coin selector + price */}
        <div className="flex items-center gap-3 flex-wrap">
          <CoinSelector value={symbol} onChange={setSymbol} />
          {latest && (
            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-bold tabular-nums">
                ${formatPrice(latest.close)}
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

        {/* Right: Interval selector */}
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

      {/* Error Banner */}
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
          latest && priceChange !== null ? (
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
        <div className="h-[220px] sm:h-[320px] lg:h-[380px] relative">
          {loading ? <LoadingBounce /> : <CandleChart data={data} />}
        </div>
      </ChartCard>

      {/* Ratio Chart */}
      <ChartCard
        title="Futures / Spot Volume Ratio"
        indicator="bg-violet-400"
        badge={
          latest ? (
            <span className="text-sm font-bold text-violet-400 tabular-nums">
              {latest.ratio.toFixed(2)}x
            </span>
          ) : null
        }
      >
        <div className="h-[140px] sm:h-[180px] lg:h-[200px] relative">
          {loading ? <LoadingBounce /> : <RatioChart data={data} />}
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
                <span className="text-blue-400 font-semibold">
                  {formatVolume(latest.spotVolume)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-orange-500/80 inline-block" />
                <span className="text-gray-400 hidden sm:inline">Futures</span>
                <span className="text-orange-400 font-semibold">
                  {formatVolume(latest.futuresVolume)}
                </span>
              </div>
            </div>
          ) : null
        }
      >
        <div className="h-[160px] sm:h-[220px] lg:h-[250px] relative">
          {loading ? <LoadingBounce /> : <VolumeBarChart data={data} />}
        </div>
      </ChartCard>

      <p className="text-center text-xs text-gray-700 pb-2">
        Binance Perpetual Futures · {INTERVAL_OPTIONS.find((o) => o.value === interval)?.label} · Refreshes every 60s
      </p>
    </main>
  );
}
