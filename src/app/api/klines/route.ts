import { NextRequest, NextResponse } from 'next/server';
import { fetchAllKlines } from '@/lib/binance';
import { MergedData } from '@/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'BTCUSDT';
  const interval = searchParams.get('interval') || '4h';

  try {
    const [spotData, futuresData] = await Promise.all([
      fetchAllKlines(symbol, interval, 'spot'),
      fetchAllKlines(symbol, interval, 'futures'),
    ]);

    const futuresMap = new Map(futuresData.map((d) => [d.timestamp, d]));

    const merged: MergedData[] = spotData
      .filter((s) => futuresMap.has(s.timestamp))
      .map((s) => {
        const f = futuresMap.get(s.timestamp)!;
        return {
          timestamp: s.timestamp,
          open: s.open,
          high: s.high,
          low: s.low,
          close: s.close,
          spotVolume: s.volume,
          futuresVolume: f.volume,
          ratio: s.volume > 0 ? f.volume / s.volume : 0,
        };
      });

    return NextResponse.json(merged, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
