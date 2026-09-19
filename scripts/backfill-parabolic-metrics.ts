// One-off backfill: recomputes `metrics` (new fields added: slopes, ratios,
// breakout/sweep/recovery, volume ratios) and fills in the new `candles`
// snapshot for every ParabolicCase written before those existed.
//
// Run with: npm run backfill:parabolic
//
// tsx doesn't auto-load .env.local (only Next.js does), so load it explicitly
// before touching prisma, same as prisma.config.ts does.
import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';
import {
  candlesToTuples,
  computeParabolicMetrics,
  computeVolumeRatios,
  fetchParabolicCandles,
  pointsFromRow,
} from '../src/lib/parabolic';

async function main() {
  const rows = await prisma.parabolicCase.findMany({ orderBy: { l0Time: 'asc' } });
  console.log(`${rows.length}개 사례를 재계산합니다...`);

  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const points = pointsFromRow(row);
      const metrics = {
        ...computeParabolicMetrics(points),
        volumeRatios: computeVolumeRatios({
          rise1Vol: row.rise1Vol,
          drop1Vol: row.drop1Vol,
          rise2Vol: row.rise2Vol,
          drop2Vol: row.drop2Vol,
          rise3Vol: row.rise3Vol,
          postDropVol: row.postDropVol,
          reboundVol: row.reboundVol,
        }),
      };
      const candles = await fetchParabolicCandles(row.symbol, row.timeframe, points);

      await prisma.parabolicCase.update({
        where: { id: row.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          metrics: metrics as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          candles: candlesToTuples(candles) as any,
        },
      });
      ok++;
      console.log(`✔ ${row.symbol} ${row.timeframe} (${row.id}) — 캔들 ${candles.length}개`);
    } catch (err) {
      failed++;
      console.error(`✘ ${row.symbol} (${row.id}):`, err instanceof Error ? err.message : err);
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
