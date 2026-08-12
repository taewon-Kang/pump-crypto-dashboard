import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Side, PumpPhase } from '@/generated/prisma/enums';
import { computeLsMetrics, resolveEntryPrice } from '@/lib/lsReturns';

export const maxDuration = 60;

const PUMP_PHASES = new Set<string>(Object.values(PumpPhase));

/** Best-effort BTC price snapshot for older rows written before btcPriceAtEntry existed. */
async function backfillBtcPrice(id: string, symbol: string, entryTimeMs: number, entryPrice: number) {
  try {
    const btcPriceAtEntry = symbol === 'BTCUSDT' ? entryPrice : await resolveEntryPrice('BTCUSDT', entryTimeMs);
    await prisma.longShortEntry.update({ where: { id }, data: { btcPriceAtEntry } });
    return btcPriceAtEntry;
  } catch {
    // Leave it null — next load will retry.
    return null;
  }
}

export async function GET() {
  try {
    const entries = await prisma.longShortEntry.findMany({
      orderBy: { entryTime: 'desc' },
    });

    const results = await Promise.all(
      entries.map(async (entry) => {
        const entryTimeMs = entry.entryTime.getTime();
        const endTimeMs = entry.endedAt?.getTime() ?? null;
        try {
          const btcPriceAtEntry =
            entry.btcPriceAtEntry ?? (await backfillBtcPrice(entry.id, entry.symbol, entryTimeMs, entry.entryPrice));

          const [metrics, btcMetrics] = await Promise.all([
            computeLsMetrics(entry.symbol, entry.side, entryTimeMs, entry.entryPrice, endTimeMs),
            btcPriceAtEntry != null
              ? computeLsMetrics('BTCUSDT', Side.LONG, entryTimeMs, btcPriceAtEntry, endTimeMs)
              : Promise.resolve(null),
          ]);

          return {
            ...entry,
            entryTime: entryTimeMs,
            btcPriceAtEntry,
            endedAt: endTimeMs,
            metrics,
            btcMetrics,
            error: null,
          };
        } catch (err) {
          return {
            ...entry,
            entryTime: entryTimeMs,
            endedAt: endTimeMs,
            metrics: null,
            btcMetrics: null,
            error: err instanceof Error ? err.message : '가격 조회 실패',
          };
        }
      })
    );

    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symbol = typeof body.symbol === 'string' ? body.symbol.toUpperCase() : '';
    const side = body.side === 'SHORT' ? Side.SHORT : body.side === 'LONG' ? Side.LONG : null;
    const entryTimeMs = Number(body.entryTime);
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    const pumpPhase = typeof body.pumpPhase === 'string' && PUMP_PHASES.has(body.pumpPhase) ? (body.pumpPhase as PumpPhase) : null;

    if (!symbol || !side || !Number.isFinite(entryTimeMs)) {
      return NextResponse.json({ error: '심볼/방향/진입 시각을 확인해주세요.' }, { status: 400 });
    }
    if (entryTimeMs > Date.now()) {
      return NextResponse.json({ error: '진입 시각은 현재보다 이후일 수 없습니다.' }, { status: 400 });
    }

    const entryPrice = await resolveEntryPrice(symbol, entryTimeMs);
    const btcPriceAtEntry = symbol === 'BTCUSDT' ? entryPrice : await resolveEntryPrice('BTCUSDT', entryTimeMs);

    const entry = await prisma.longShortEntry.create({
      data: {
        symbol,
        side,
        entryTime: new Date(entryTimeMs),
        entryPrice,
        btcPriceAtEntry,
        pumpPhase,
        note,
      },
    });

    const [metrics, btcMetrics] = await Promise.all([
      computeLsMetrics(symbol, side, entryTimeMs, entryPrice),
      computeLsMetrics('BTCUSDT', Side.LONG, entryTimeMs, btcPriceAtEntry),
    ]);

    return NextResponse.json({
      ...entry,
      entryTime: entry.entryTime.getTime(),
      endedAt: null,
      metrics,
      btcMetrics,
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
