import { NextRequest, NextResponse } from 'next/server';
import { fetchAllKlines } from '@/lib/binance';

export const maxDuration = 60;
// Region is set project-wide via vercel.json ("regions": ["icn1"]) — Binance
// blocks US IPs (451), see src/app/api/klines/route.ts.

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const symbol = sp.get('symbol');
  const interval = sp.get('interval');

  if (!symbol || !interval) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    // Full history (paginated back to the earliest available candle), same
    // as the home Volume Gap chart, so the picker's chart goes all the way
    // back to the coin's futures listing instead of stopping at the most
    // recent page. Binance futures — volume sums elsewhere in this feature
    // are computed from futures klines too.
    const candles = await fetchAllKlines(symbol, interval, 'futures');
    return NextResponse.json(candles, {
      // Includes the still-forming latest candle, so keep the CDN TTL short.
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
