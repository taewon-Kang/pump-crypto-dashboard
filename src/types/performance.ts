export type Exchange = 'upbit' | 'binance';
export type PriceType = 'open' | 'high' | 'low' | 'close';
export type SortColumn = 'rank' | 'symbol' | 'startPrice' | 'endPrice' | 'change';
export type SortDir = 'asc' | 'desc';

export interface CoinPerformance {
  symbol: string;
  name: string;
  startPrice: number;
  endPrice: number;
  change: number;
}

export interface PerformanceResult {
  results: CoinPerformance[];
  totalCoins: number;
  failedCoins: number;
  durationMs: number;
}

export const PRICE_TYPE_OPTIONS: { value: PriceType; label: string }[] = [
  { value: 'open', label: '시가' },
  { value: 'high', label: '고가' },
  { value: 'low', label: '저가' },
  { value: 'close', label: '종가' },
];
