import { NextResponse } from 'next/server';
import { runBinanceSync } from '@/lib/binanceSync';

export const maxDuration = 120;

// Vercel Cron calls this on a schedule (GET, see vercel.json); the
// "실거래 내역" page's manual refresh button calls the same handler via POST.
// Both are read-only from Binance's perspective — this only fetches account
// history and writes to our own DB, it never places or cancels an order.
async function handle() {
  try {
    const summary = await runBinanceSync();
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
