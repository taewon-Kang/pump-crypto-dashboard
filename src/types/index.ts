export type Interval = '4h' | '1d' | '1w';

export interface MergedData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  spotVolume: number;
  futuresVolume: number;
  ratio: number;
}

export interface KlineRaw {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const COIN_OPTIONS = [
  { value: 'BTCUSDT', label: 'BTC/USDT' },
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'SOLUSDT', label: 'SOL/USDT' },
  { value: 'BNBUSDT', label: 'BNB/USDT' },
  { value: 'XRPUSDT', label: 'XRP/USDT' },
  { value: 'DOGEUSDT', label: 'DOGE/USDT' },
  { value: 'AVAXUSDT', label: 'AVAX/USDT' },
  { value: 'LINKUSDT', label: 'LINK/USDT' },
  { value: 'DOTUSDT', label: 'DOT/USDT' },
];

export const INTERVAL_OPTIONS: { value: Interval; label: string }[] = [
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
];
