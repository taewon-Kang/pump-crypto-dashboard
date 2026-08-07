'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useMarketData } from '@/hooks/useMarketData';
import { COIN_OPTIONS, INTERVAL_OPTIONS, type Interval } from '@/types';
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

function LoadingChart({ height }: { height: number }) {
  return (
    <div style={{ height }} className="flex items-center justify-center">
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

export default function HomePage() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState<Interval>('4h');
  const { data, loading, error } = useMarketData(symbol, interval);

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const priceChange =
    latest && prev ? ((latest.close - prev.close) / prev.close) * 100 : null;

  const coinLabel = COIN_OPTIONS.find((c) => c.value === symbol)?.label ?? symbol;

  return (
    <div className="min-h-screen bg-[#0B0E1A] text-gray-100">
      {/* Header */}
      <header className="border-b border-[#1F2937] bg-[#0D1120]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">
              C
            </div>
            <span className="font-semibold text-base tracking-tight">Crypto Dashboard</span>
          </div>
          <span className="text-xs text-gray-500 hidden sm:block">
            Spot / Futures Volume Gap Analysis
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Control Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CoinSelector value={symbol} onChange={setSymbol} />
            {latest && (
              <div className="hidden sm:flex items-baseline gap-2">
                <span className="text-xl font-bold tabular-nums">
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

          {/* Interval Selector */}
          <div className="flex gap-1.5 bg-[#111827] border border-[#1F2937] rounded-lg p-1">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
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

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-red-400 text-sm">
            ⚠ 데이터 로딩 실패: {error}
          </div>
        )}

        {/* Price Chart */}
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-sm font-medium text-gray-200">{coinLabel} Price</span>
            </div>
            {latest && (
              <div className="flex items-baseline gap-2">
                <span className="font-bold">${formatPrice(latest.close)}</span>
                {priceChange !== null && (
                  <span
                    className={`text-xs font-medium ${
                      priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="p-2">
            {loading ? <LoadingChart height={350} /> : <CandleChart data={data} height={350} />}
          </div>
        </div>

        {/* Ratio Chart */}
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-sm font-medium text-gray-200">
                Futures / Spot Volume Ratio
              </span>
            </div>
            {latest && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Current</span>
                <span className="font-bold text-violet-400">{latest.ratio.toFixed(2)}x</span>
              </div>
            )}
          </div>
          <div className="p-2">
            {loading ? <LoadingChart height={200} /> : <RatioChart data={data} height={200} />}
          </div>
        </div>

        {/* Volume Comparison Chart */}
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1F2937] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm font-medium text-gray-200">Spot vs Futures Volume</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-blue-500/75" />
                <span className="text-gray-400">Spot</span>
                {latest && (
                  <span className="text-blue-400 font-semibold ml-1">
                    {formatVolume(latest.spotVolume)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-orange-500/75" />
                <span className="text-gray-400">Futures</span>
                {latest && (
                  <span className="text-orange-400 font-semibold ml-1">
                    {formatVolume(latest.futuresVolume)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="p-2">
            {loading ? (
              <LoadingChart height={250} />
            ) : (
              <VolumeBarChart data={data} height={250} />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 pb-4">
          Data from Binance · {coinLabel} Perpetual · Refreshes every 60s
        </p>
      </main>
    </div>
  );
}
