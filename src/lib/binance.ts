import { KlineRaw } from '@/types';

const SPOT_BASE = 'https://api.binance.com';
const FUTURES_BASE = 'https://fapi.binance.com';

export async function fetchKlines(
  symbol: string,
  interval: string,
  type: 'spot' | 'futures',
  limit = 200
): Promise<KlineRaw[]> {
  const base = type === 'spot' ? SPOT_BASE : FUTURES_BASE;
  const path = type === 'spot' ? '/api/v3/klines' : '/fapi/v1/klines';
  const url = `${base}${path}?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, { next: { revalidate: 60 } });

  if (!res.ok) {
    throw new Error(`Binance API error ${res.status}: ${await res.text()}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[][] = await res.json();

  return raw.map((k) => ({
    timestamp: k[0] as number,
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}
