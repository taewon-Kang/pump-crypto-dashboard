import { NextRequest, NextResponse } from 'next/server';
import { fetchKlines } from '@/lib/binance';
import type { KlineRaw } from '@/types';

export const maxDuration = 30;

const UPBIT_BASE = 'https://api.upbit.com/v1';

function upbitPath(interval: string): string {
  if (interval === '1h') return '/candles/minutes/60';
  if (interval === '4h') return '/candles/minutes/240';
  if (interval === '1d') return '/candles/days';
  if (interval === '1w') return '/candles/weeks';
  return '/candles/minutes/60';
}

type UpbitCandle = Record<string, string | number>;

async function fetchUpbitCandles(market: string, interval: string): Promise<KlineRaw[]> {
  // Upbit caps a single request at 200 candles — plenty for a detail chart.
  const url = `${UPBIT_BASE}${upbitPath(interval)}?market=${market}&count=200`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });

  if (!res.ok) throw new Error(`Upbit API error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as UpbitCandle[];
  if (!Array.isArray(data)) throw new Error('Unexpected Upbit response');

  // Upbit returns most-recent-first; charts need ascending time order.
  return data
    .map((d) => ({
      timestamp: new Date(d.candle_date_time_utc as string).getTime(),
      open: d.opening_price as number,
      high: d.high_price as number,
      low: d.low_price as number,
      close: d.trade_price as number,
      volume: d.candle_acc_trade_volume as number,
    }))
    .reverse();
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const exchange = sp.get('exchange') as 'upbit' | 'binance' | null;
  const symbol = sp.get('symbol');
  const interval = sp.get('interval') || '1d';

  if (!exchange || !symbol) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const candles =
      exchange === 'upbit'
        ? await fetchUpbitCandles(symbol, interval)
        : await fetchKlines(symbol, interval, 'spot', 500);

    return NextResponse.json(candles, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
