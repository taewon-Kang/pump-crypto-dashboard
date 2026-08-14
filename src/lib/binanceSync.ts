import { prisma } from '@/lib/prisma';
import {
  fetchIncomeHistory,
  fetchUserTradesByTime,
  fetchUserTradesFromId,
  fetchSymbolLeverage,
  type BinanceUserTrade,
} from '@/lib/binanceAccount';
import { fetchKlinesRange, fetchLatestPrice } from '@/lib/binance';
import { directionalReturn } from '@/lib/lsReturns';
import { runPositionEngine, type EngineFill, type EngineResumeState } from '@/lib/binancePositionEngine';

/**
 * Orchestrates the read-only Binance Futures account sync: pull real
 * execution history, group it into positions, and — for positions that have
 * closed — log a few post-close price checkpoints purely for context. This
 * never places, amends, or cancels an order; see src/lib/binanceAccount.ts
 * for the full (read-only) set of endpoints this is allowed to call.
 */

// Initial backfill horizon, chosen by the user (2026-05-27, Asia/Seoul).
// Incremental syncs after the first run ignore this and just resume from
// each symbol's last processed trade id.
const BACKFILL_START = Date.parse('2026-05-27T00:00:00+09:00');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SYNC_INTERVAL_MS = 60_000;

const CHECKPOINTS: { key: '3d' | '7d' | '14d' | '30d'; ms: number }[] = [
  { key: '3d', ms: 3 * 86_400_000 },
  { key: '7d', ms: 7 * 86_400_000 },
  { key: '14d', ms: 14 * 86_400_000 },
  { key: '30d', ms: 30 * 86_400_000 },
];

export interface SyncSummary {
  skipped: boolean;
  symbolsSynced: number;
  newFills: number;
  positionsTouched: number;
  observationsRecorded: number;
}

/** Fetches [start, now] in <=7-day windows (Binance's own cap on time-scoped userTrades queries). */
async function backfillTrades(symbol: string, start: number, end: number): Promise<BinanceUserTrade[]> {
  const trades: BinanceUserTrade[] = [];
  const seen = new Set<number>();
  let windowStart = start;
  let guard = 0;

  while (windowStart < end && guard < 500) {
    guard++;
    const windowEnd = Math.min(windowStart + WEEK_MS - 1, end);
    const page = await fetchUserTradesByTime(symbol, windowStart, windowEnd, 1000);
    for (const t of page) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        trades.push(t);
      }
    }
    if (page.length < 1000) {
      windowStart = windowEnd + 1;
    } else {
      // Window saturated (>=1000 fills in 7 days for this symbol) — narrow
      // instead of skipping ahead, so nothing between here and the window
      // end gets missed.
      windowStart = page[page.length - 1].time;
    }
  }
  return trades;
}

/** Resumes from a known trade id — no time bound needed, so this naturally catches up to "now". */
async function incrementalTrades(symbol: string, fromId: number): Promise<BinanceUserTrade[]> {
  const trades: BinanceUserTrade[] = [];
  let cursor = fromId;
  for (let i = 0; i < 50; i++) {
    const page = await fetchUserTradesFromId(symbol, cursor, 1000);
    if (!page.length) break;
    trades.push(...page);
    if (page.length < 1000) break;
    cursor = page[page.length - 1].id + 1;
  }
  return trades;
}

/** Every symbol with realized-income activity since BACKFILL_START — avoids blindly polling every futures symbol. */
async function discoverActiveSymbols(): Promise<Set<string>> {
  const symbols = new Set<string>();
  let windowStart = BACKFILL_START;
  const end = Date.now();
  let guard = 0;

  while (windowStart < end && guard < 200) {
    guard++;
    const page = await fetchIncomeHistory({ startTime: windowStart, endTime: end, limit: 1000 });
    for (const row of page) if (row.symbol) symbols.add(row.symbol);
    if (page.length < 1000) break;
    windowStart = page[page.length - 1].time + 1;
  }

  // Keep polling any symbol we've synced before too, even if this window's
  // income query happens to miss it (e.g. a position still open with no
  // realized income yet).
  const known = await prisma.binanceSyncCursor.findMany({ select: { symbol: true } });
  for (const k of known) symbols.add(k.symbol);

  return symbols;
}

async function syncSymbol(symbol: string): Promise<{ newFills: number; positionsTouched: number }> {
  const cursor = await prisma.binanceSyncCursor.findUnique({ where: { symbol } });
  const raw =
    cursor && cursor.lastTradeId > BigInt(0)
      ? await incrementalTrades(symbol, Number(cursor.lastTradeId) + 1)
      : await backfillTrades(symbol, BACKFILL_START, Date.now());

  if (raw.length > 0) {
    await prisma.binanceFill.createMany({
      data: raw.map((t) => ({
        symbol: t.symbol,
        binanceTradeId: BigInt(t.id),
        orderId: BigInt(t.orderId),
        side: t.side,
        positionSide: t.positionSide,
        price: parseFloat(t.price),
        qty: parseFloat(t.qty),
        quoteQty: parseFloat(t.quoteQty),
        realizedPnl: parseFloat(t.realizedPnl),
        commission: parseFloat(t.commission),
        commissionAsset: t.commissionAsset,
        isMaker: t.maker,
        time: new Date(t.time),
      })),
      skipDuplicates: true,
    });

    const maxId = raw.reduce((m, t) => Math.max(m, t.id), Number(cursor?.lastTradeId ?? 0));
    await prisma.binanceSyncCursor.upsert({
      where: { symbol },
      create: { symbol, lastTradeId: BigInt(maxId), lastSyncedAt: new Date() },
      update: { lastTradeId: BigInt(maxId), lastSyncedAt: new Date() },
    });
  } else {
    await prisma.binanceSyncCursor.upsert({
      where: { symbol },
      create: { symbol, lastTradeId: BigInt(0), lastSyncedAt: new Date() },
      update: { lastSyncedAt: new Date() },
    });
  }

  const unassigned = await prisma.binanceFill.findMany({
    where: { symbol, positionId: null },
    orderBy: { time: 'asc' },
  });
  if (unassigned.length === 0) return { newFills: raw.length, positionsTouched: 0 };

  const buckets = new Map<string, typeof unassigned>();
  for (const f of unassigned) {
    if (!buckets.has(f.positionSide)) buckets.set(f.positionSide, []);
    buckets.get(f.positionSide)!.push(f);
  }

  let positionsTouched = 0;
  let leverage: number | null | undefined; // fetched at most once per symbol per sync call

  for (const [bucketKey, fills] of buckets) {
    const where = bucketKey === 'BOTH' ? { symbol } : { symbol, side: bucketKey as 'LONG' | 'SHORT' };
    const latest = await prisma.binancePosition.findFirst({ where, orderBy: { openedAt: 'desc' } });
    const resume: EngineResumeState | null =
      latest && latest.status === 'OPEN'
        ? {
            positionId: latest.id,
            side: latest.side,
            openedAt: latest.openedAt.getTime(),
            entryQty: latest.entryQty,
            entryNotional: latest.entryNotional,
            exitQty: latest.exitQty,
            exitNotional: latest.exitNotional,
            realizedPnl: latest.realizedPnl,
            commission: latest.commission,
            commissionAsset: latest.commissionAsset,
          }
        : null;

    const engineFills: EngineFill[] = fills.map((f) => ({
      id: f.id,
      side: f.side as 'BUY' | 'SELL',
      positionSide: f.positionSide as 'LONG' | 'SHORT' | 'BOTH',
      price: f.price,
      qty: f.qty,
      realizedPnl: f.realizedPnl,
      commission: f.commission,
      commissionAsset: f.commissionAsset,
      time: f.time.getTime(),
    }));

    const segments = runPositionEngine(resume, engineFills);

    for (const seg of segments) {
      positionsTouched++;
      let positionId = seg.resumeId;

      if (!positionId) {
        if (leverage === undefined) leverage = await fetchSymbolLeverage(symbol);
        const created = await prisma.binancePosition.create({
          data: {
            symbol,
            side: seg.side,
            status: seg.status,
            openedAt: new Date(seg.openedAt),
            closedAt: seg.closedAt ? new Date(seg.closedAt) : null,
            entryQty: seg.entryQty,
            entryNotional: seg.entryNotional,
            exitQty: seg.exitQty,
            exitNotional: seg.exitNotional,
            realizedPnl: seg.realizedPnl,
            commission: seg.commission,
            commissionAsset: seg.commissionAsset,
            leverage: leverage ?? null,
          },
        });
        positionId = created.id;
      } else {
        await prisma.binancePosition.update({
          where: { id: positionId },
          data: {
            status: seg.status,
            closedAt: seg.closedAt ? new Date(seg.closedAt) : null,
            entryQty: seg.entryQty,
            entryNotional: seg.entryNotional,
            exitQty: seg.exitQty,
            exitNotional: seg.exitNotional,
            realizedPnl: seg.realizedPnl,
            commission: seg.commission,
            commissionAsset: seg.commissionAsset,
          },
        });
      }

      for (const a of seg.fillAssignments) {
        await prisma.binanceFill.update({
          where: { id: a.fillId },
          data: { positionId, eventType: a.eventType },
        });
      }
    }
  }

  return { newFills: raw.length, positionsTouched };
}

/**
 * For closed positions, logs the price at each 3d/7d/14d/30d checkpoint
 * after close — same cadence as the manual L/S Tracker's own checkpoints,
 * but stored in a separate table so it can never be mistaken for realized
 * trading performance.
 */
async function recordPostCloseObservations(): Promise<number> {
  const closed = await prisma.binancePosition.findMany({
    where: { status: 'CLOSED', closedAt: { not: null } },
    include: { observations: true },
  });

  const now = Date.now();
  let recorded = 0;

  for (const pos of closed) {
    if (pos.exitQty <= 0) continue;
    const avgExitPrice = pos.exitNotional / pos.exitQty;
    const closedAtMs = pos.closedAt!.getTime();
    const have = new Set(pos.observations.map((o) => o.checkpoint));

    for (const cp of CHECKPOINTS) {
      if (have.has(cp.key)) continue;
      const targetTime = closedAtMs + cp.ms;
      if (now < targetTime) continue;

      let price: number | null = null;
      try {
        const candles = await fetchKlinesRange(pos.symbol, '1h', 'futures', targetTime, targetTime + 3_600_000, 1);
        price = candles[0]?.open ?? null;
        if (price === null) price = await fetchLatestPrice(pos.symbol, 'futures');
      } catch {
        continue; // best-effort — retried next sync run
      }
      if (price === null) continue;

      const returnPct = directionalReturn(price, avgExitPrice, pos.side);
      await prisma.postCloseObservation.create({
        data: { positionId: pos.id, checkpoint: cp.key, observedAt: new Date(targetTime), price, returnPct },
      });
      recorded++;
    }
  }

  return recorded;
}

export async function runBinanceSync(): Promise<SyncSummary> {
  const meta = await prisma.binanceSyncMeta.findUnique({ where: { id: 1 } });
  if (meta?.lastRunAt && Date.now() - meta.lastRunAt.getTime() < MIN_SYNC_INTERVAL_MS) {
    return { skipped: true, symbolsSynced: 0, newFills: 0, positionsTouched: 0, observationsRecorded: 0 };
  }

  await prisma.binanceSyncMeta.upsert({
    where: { id: 1 },
    create: { id: 1, lastRunAt: new Date(), lastRunStatus: 'running' },
    update: { lastRunAt: new Date(), lastRunStatus: 'running' },
  });

  try {
    const symbols = await discoverActiveSymbols();
    let newFills = 0;
    let positionsTouched = 0;

    for (const symbol of symbols) {
      const res = await syncSymbol(symbol);
      newFills += res.newFills;
      positionsTouched += res.positionsTouched;
    }

    const observationsRecorded = await recordPostCloseObservations();

    await prisma.binanceSyncMeta.update({
      where: { id: 1 },
      data: { lastRunStatus: 'ok', lastError: null },
    });

    return { skipped: false, symbolsSynced: symbols.size, newFills, positionsTouched, observationsRecorded };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.binanceSyncMeta.update({
      where: { id: 1 },
      data: { lastRunStatus: 'error', lastError: message },
    });
    throw err;
  }
}
