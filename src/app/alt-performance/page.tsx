'use client';
import { useState, useRef, useEffect } from 'react';
import type { Exchange, PriceType, CoinPerformance, PerformanceResult } from '@/types/performance';
import ExchangeSelector from '@/components/ExchangeSelector';
import TimeframeSelector from '@/components/TimeframeSelector';
import DateRangePicker from '@/components/DateRangePicker';
import PriceTypeSelector from '@/components/PriceTypeSelector';
import SearchBar from '@/components/SearchBar';
import CoinPerformanceTable from '@/components/CoinPerformanceTable';
import PriceVolumeChart from '@/components/PriceVolumeChart';
import { useCoinKlines } from '@/hooks/useCoinKlines';

// Resolve a table row back into the symbol format each exchange's candle API expects.
function resolveChartSymbol(coin: CoinPerformance, exchange: Exchange): string {
  return exchange === 'upbit' ? `KRW-${coin.symbol}` : coin.name;
}

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function getDefaults() {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  const start = new Date(end.getTime() - 7 * 86_400_000);
  return { start: toDateTimeLocal(start), end: toDateTimeLocal(end) };
}

function formatPrice(v: number, exchange: Exchange): string {
  if (exchange === 'upbit') {
    if (v >= 1000) return '₩' + Math.round(v).toLocaleString('ko-KR');
    if (v >= 1) return '₩' + v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    return '₩' + v.toPrecision(4);
  }
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return '$' + v.toFixed(4);
  if (v <= 0) return '$0';
  const mag = Math.abs(Math.floor(Math.log10(v)));
  return '$' + v.toFixed(Math.min(10, mag + 4));
}

export default function AltPerformancePage() {
  const defaults = getDefaults();

  const [exchange, setExchange] = useState<Exchange>('binance');
  const [interval, setInterval] = useState('1d');
  const [startDT, setStartDT] = useState(defaults.start);
  const [endDT, setEndDT] = useState(defaults.end);
  const [startPT, setStartPT] = useState<PriceType>('close');
  const [endPT, setEndPT] = useState<PriceType>('close');

  // resultExchange is set only when a query completes — keeps table format stable
  // while the user switches the exchange selector before re-querying
  const [resultExchange, setResultExchange] = useState<Exchange>('binance');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PerformanceResult | null>(null);
  const [search, setSearch] = useState('');

  // Coin detail chart — selecting a table row swaps this out for the clicked coin
  const [selectedCoin, setSelectedCoin] = useState<CoinPerformance | null>(null);
  const [chartInterval, setChartInterval] = useState('1d');
  const chartCardRef = useRef<HTMLDivElement>(null);

  const chartSymbol = selectedCoin ? resolveChartSymbol(selectedCoin, resultExchange) : null;
  const {
    data: chartData,
    loading: chartLoading,
    error: chartError,
  } = useCoinKlines(chartSymbol, resultExchange, chartInterval);

  useEffect(() => {
    if (selectedCoin) {
      chartCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedCoin]);

  function handleSelectCoin(coin: CoinPerformance) {
    setSelectedCoin((prev) => (prev?.symbol === coin.symbol ? prev : coin));
  }

  async function handleQuery() {
    if (!startDT || !endDT) {
      setError('시작/종료 날짜를 선택해주세요.');
      return;
    }
    const startMs = new Date(startDT).getTime();
    const endMs = new Date(endDT).getTime();
    if (startMs >= endMs) {
      setError('종료 시간은 시작 시간보다 이후여야 합니다.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSearch('');
    setSelectedCoin(null);

    try {
      const params = new URLSearchParams({
        exchange,
        interval,
        startTime: String(startMs),
        endTime: String(endMs),
        startPriceType: startPT,
        endPriceType: endPT,
      });
      const res = await fetch(`/api/coin-performance?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: PerformanceResult = await res.json();
      setResult(data);
      setResultExchange(exchange); // lock the format to the exchange that was queried
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  const coins: CoinPerformance[] = result?.results ?? [];
  const positive = coins.filter((c) => c.change >= 0).length;
  const negative = coins.filter((c) => c.change < 0).length;

  return (
    <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-3 sm:py-4 space-y-3">
      {/* Control Panel */}
      <div className="bg-[#111827] rounded-xl border border-[#1F2937] p-4 space-y-4">
        {/* Row 1: Exchange + Timeframe + Query button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">거래소</span>
            <ExchangeSelector value={exchange} onChange={setExchange} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider pl-0.5">Timeframe</span>
            <TimeframeSelector value={interval} onChange={setInterval} />
          </div>
          <button
            onClick={handleQuery}
            disabled={loading}
            className="ml-auto mt-4 flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed
                       text-white text-sm font-semibold transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                조회 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                조회
              </>
            )}
          </button>
        </div>

        {/* Row 2: Date range */}
        <DateRangePicker
          startValue={startDT}
          endValue={endDT}
          onStartChange={setStartDT}
          onEndChange={setEndDT}
        />

        {/* Row 3: Price type */}
        <PriceTypeSelector
          startType={startPT}
          endType={endPT}
          onStartChange={setStartPT}
          onEndChange={setEndPT}
        />

        {/* Hint */}
        <p className="text-xs text-gray-700">
          시간은 현지 시간 기준입니다. 캔들 기준 시작가({startPT}) → 종료가({endPT})로 수익률을 계산합니다.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Loading hint */}
      {loading && (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-8 text-center space-y-2">
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500">
            {exchange === 'upbit' ? 'Upbit' : 'Binance'} 전체 코인 데이터를 가져오는 중입니다...
          </p>
          <p className="text-xs text-gray-700">코인 수에 따라 10~30초 소요될 수 있습니다</p>
        </div>
      )}

      {/* Results summary */}
      {result && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gray-400">
              총 <span className="text-gray-100 font-semibold">{coins.length}</span>개 코인
            </span>
            <span className="text-emerald-400">
              ▲ {positive}개
            </span>
            <span className="text-red-400">
              ▼ {negative}개
            </span>
            {result.failedCoins > 0 && (
              <span className="text-gray-600 text-xs">
                (조회 실패 {result.failedCoins}개 제외)
              </span>
            )}
            <span className="text-gray-700 text-xs">
              {(result.durationMs / 1000).toFixed(1)}초
            </span>
          </div>
          <SearchBar value={search} onChange={setSearch} />
        </div>
      )}

      {/* Coin detail chart — appears once a table row is clicked */}
      {selectedCoin && (
        <div
          ref={chartCardRef}
          className="bg-[#111827] rounded-xl border border-[#1F2937] overflow-hidden scroll-mt-3"
        >
          <div className="px-4 py-2.5 border-b border-[#1F2937] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-semibold text-gray-100 truncate">{selectedCoin.symbol}</span>
              <span className="text-xs text-gray-600 truncate hidden sm:inline">{selectedCoin.name}</span>
              {chartData.length > 0 && (
                <span className="flex items-baseline gap-1.5 shrink-0">
                  <span className="text-sm font-mono tabular-nums text-gray-200">
                    {formatPrice(chartData[chartData.length - 1].close, resultExchange)}
                  </span>
                  {chartData.length > 1 && (() => {
                    const last = chartData[chartData.length - 1];
                    const prev = chartData[chartData.length - 2];
                    const pct = ((last.close - prev.close) / prev.close) * 100;
                    return (
                      <span
                        className={`text-xs font-medium ${
                          pct >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {pct >= 0 ? '+' : ''}
                        {pct.toFixed(2)}%
                      </span>
                    );
                  })()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <TimeframeSelector value={chartInterval} onChange={setChartInterval} />
              <button
                onClick={() => setSelectedCoin(null)}
                aria-label="차트 닫기"
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-[#1F2937] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="relative h-[240px] sm:h-[320px] lg:h-[380px]">
            {chartLoading ? (
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
            ) : chartError ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 px-4 text-center">
                ⚠ {chartError}
              </div>
            ) : (
              <PriceVolumeChart data={chartData} />
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {coins.length > 0 && !loading && (
        <CoinPerformanceTable
          data={coins}
          exchange={resultExchange}
          searchQuery={search}
          selectedSymbol={selectedCoin?.symbol}
          onSelect={handleSelectCoin}
        />
      )}

      {/* Empty state */}
      {result && coins.length === 0 && !loading && (
        <div className="bg-[#111827] rounded-xl border border-[#1F2937] px-4 py-12 text-center text-gray-600 text-sm">
          조회된 데이터가 없습니다. 날짜 범위를 확인해주세요.
        </div>
      )}
    </main>
  );
}
