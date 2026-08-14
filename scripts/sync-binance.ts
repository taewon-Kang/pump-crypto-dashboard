// One-off / manual trigger for the Binance real-trade sync (see
// src/lib/binanceSync.ts). Same function the /api/binance/sync route and
// Vercel Cron call — this just lets it run from the CLI too.
//
// Run with: npm run sync:binance
//
// tsx doesn't auto-load .env.local (only Next.js does), so load it explicitly.
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';
import { runBinanceSync } from '../src/lib/binanceSync';

async function main() {
  // --force clears the 60s overlap lock (useful right after a failed run).
  if (process.argv.includes('--force')) {
    await prisma.binanceSyncMeta.deleteMany({});
  }
  console.log('바이낸스 실거래 내역 동기화 중...');
  const summary = await runBinanceSync();
  console.log(summary);
}

main()
  .catch((err) => {
    console.error('동기화 실패:', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
