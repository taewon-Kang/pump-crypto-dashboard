import { NextResponse } from 'next/server';

export const maxDuration = 30;
// Function region is set project-wide via vercel.json ("regions": ["icn1"]).
// `preferredRegion` is deprecated in Next.js and no longer accepts region
// codes on Vercel — see src/app/api/klines/route.ts for details.

interface BinanceSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
}

export async function GET() {
  try {
    const res = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo', {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

    const data: { symbols: BinanceSymbol[] } = await res.json();

    const coins = data.symbols
      .filter(
        (s) =>
          s.status === 'TRADING' &&
          s.contractType === 'PERPETUAL' &&
          s.quoteAsset === 'USDT'
      )
      .map((s) => ({ symbol: s.symbol, baseAsset: s.baseAsset }))
      .sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));

    return NextResponse.json(coins, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
