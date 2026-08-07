import { KlineRaw } from '@/types';

const SPOT_BASE = 'https://api.binance.com';
const FUTURES_BASE = 'https://fapi.binance.com';

export async function fetchKlines(
  symbol: string,
  interval: string,
  type: 'spot' | 'futures',
  limit = 1500,
  endTime?: number
): Promise<KlineRaw[]> {
  const base = type === 'spot' ? SPOT_BASE : FUTURES_BASE;
  const path = type === 'spot' ? '/api/v3/klines' : '/fapi/v1/klines';

  let url = `${base}${path}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (endTime) url += `&endTime=${endTime}`;

  const res = await fetch(url, { next: { revalidate: 300 } });

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

export async function fetchAllKlines(
  symbol: string,
  interval: string,
  type: 'spot' | 'futures'
): Promise<KlineRaw[]> {
  const LIMIT = 1500;
  const MAX_PAGES = 20; // up to 30,000 candles
  const pages: KlineRaw[][] = [];
  let endTime: number | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await fetchKlines(symbol, interval, type, LIMIT, endTime);
    if (!batch.length) break;

    pages.unshift(batch);

    if (batch.length < LIMIT) break; // reached the beginning of history

    endTime = batch[0].timestamp - 1;
  }

  return pages.flat();
}
