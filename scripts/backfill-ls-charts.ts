// One-off backfill: generates the daily-candle chart snapshot (see
// src/lib/chartSnapshot.ts) for every LongShortEntry that doesn't have one
// yet — i.e. every row written before auto-capture-on-create existed.
//
// Run with: npm run backfill:ls-charts
//
// tsx doesn't auto-load .env.local (only Next.js does), so load it explicitly
// before touching prisma/blob, same as prisma.config.ts does.
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';
import { generateAndStoreLsChart } from '../src/lib/chartSnapshot';

async function main() {
  const entries = await prisma.longShortEntry.findMany({
    where: { chartImageUrl: null },
    orderBy: { entryTime: 'asc' },
  });

  console.log(`${entries.length}개 기록에 스크린샷이 없습니다. 채우는 중...`);

  let ok = 0;
  let failed = 0;
  for (const entry of entries) {
    try {
      const url = await generateAndStoreLsChart(entry);
      ok++;
      console.log(`✔ ${entry.symbol} (${entry.id}) → ${url}`);
    } catch (err) {
      failed++;
      console.error(`✘ ${entry.symbol} (${entry.id}):`, err instanceof Error ? err.message : err);
    }
    // Small delay between calls so we don't hammer Binance's kline endpoint.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`완료: 성공 ${ok}, 실패 ${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
