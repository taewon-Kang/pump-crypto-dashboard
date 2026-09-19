import { NextRequest, NextResponse } from 'next/server';
import { fetchKlines } from '@/lib/binance';

export const maxDuration = 30;
// Region is set project-wide via vercel.json ("regions": ["icn1"]) — Binance
// blocks US IPs (451), see src/app/api/klines/route.ts.

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const symbol = sp.get('symbol');
  const interval = sp.get('interval');
  const endTimeParam = sp.get('endTime');
  const endTime = endTimeParam ? Number(endTimeParam) : undefined;

  if (!symbol || !interval) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    // Binance futures — matches the rest of the pump-structure feature
    // (volume sums are computed from futures klines too).
    const candles = await fetchKlines(symbol, interval, 'futures', 1000, endTime);
    return NextResponse.json(candles, {
      headers: endTime
        ? { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' }
        : { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
