import { NextRequest, NextResponse } from 'next/server';
import { fetchAllLatestPrices } from '@/lib/binance';

/** Short-poll endpoint: current futures prices for the requested symbols, e.g. ?symbols=BTCUSDT,JTOUSDT. */
export async function GET(req: NextRequest) {
  const wanted = new Set((req.nextUrl.searchParams.get('symbols') ?? '').split(',').filter(Boolean));
  if (!wanted.size) return NextResponse.json({});

  try {
    const all = await fetchAllLatestPrices('futures');
    const result: Record<string, number> = {};
    for (const symbol of wanted) {
      if (all[symbol] !== undefined) result[symbol] = all[symbol];
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
