import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Side } from '@/generated/prisma/enums';
import { computeLsMetrics, resolveEntryPrice } from '@/lib/lsReturns';

export const maxDuration = 30;

export async function GET() {
  try {
    const entries = await prisma.longShortEntry.findMany({
      orderBy: { entryTime: 'desc' },
    });

    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          const metrics = await computeLsMetrics(
            entry.symbol,
            entry.side,
            entry.entryTime.getTime(),
            entry.entryPrice
          );
          return { ...entry, entryTime: entry.entryTime.getTime(), metrics, error: null };
        } catch (err) {
          return {
            ...entry,
            entryTime: entry.entryTime.getTime(),
            metrics: null,
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

    if (!symbol || !side || !Number.isFinite(entryTimeMs)) {
      return NextResponse.json({ error: '심볼/방향/진입 시각을 확인해주세요.' }, { status: 400 });
    }
    if (entryTimeMs > Date.now()) {
      return NextResponse.json({ error: '진입 시각은 현재보다 이후일 수 없습니다.' }, { status: 400 });
    }

    const entryPrice = await resolveEntryPrice(symbol, entryTimeMs);

    const entry = await prisma.longShortEntry.create({
      data: {
        symbol,
        side,
        entryTime: new Date(entryTimeMs),
        entryPrice,
        note,
      },
    });

    const metrics = await computeLsMetrics(symbol, side, entryTimeMs, entryPrice);

    return NextResponse.json({ ...entry, entryTime: entry.entryTime.getTime(), metrics, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
