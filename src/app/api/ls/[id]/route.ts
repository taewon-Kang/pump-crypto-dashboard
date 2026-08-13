import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Side, PumpPhase } from '@/generated/prisma/enums';
import { computeLsMetrics, resolveEntryPrice } from '@/lib/lsReturns';
import { generateAndStoreLsChart } from '@/lib/chartSnapshot';
import type { Prisma } from '@/generated/prisma/client';

export const maxDuration = 30;

const PUMP_PHASES = new Set<string>(Object.values(PumpPhase));

/**
 * Partial edit of an existing entry. Supports:
 * - symbol / side / entryTime / note / pumpPhase edits
 * - ending tracking (`endedAt: <ms>`) and reopening it (`endedAt: null`)
 * Changing symbol or entryTime re-snapshots entryPrice and btcPriceAtEntry,
 * mirroring how a fresh entry is created.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const existing = await prisma.longShortEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await req.json();
    const data: Prisma.LongShortEntryUpdateInput = {};

    let symbol = existing.symbol;
    let entryTimeMs = existing.entryTime.getTime();
    let repriceNeeded = false;

    if (typeof body.symbol === 'string' && body.symbol.trim()) {
      const nextSymbol = body.symbol.toUpperCase();
      if (nextSymbol !== symbol) {
        symbol = nextSymbol;
        data.symbol = symbol;
        repriceNeeded = true;
      }
    }

    if (body.side === 'LONG' || body.side === 'SHORT') {
      data.side = body.side as Side;
    }

    if (body.entryTime !== undefined) {
      const t = Number(body.entryTime);
      if (!Number.isFinite(t)) {
        return NextResponse.json({ error: '진입 시각이 올바르지 않습니다.' }, { status: 400 });
      }
      if (t > Date.now()) {
        return NextResponse.json({ error: '진입 시각은 현재보다 이후일 수 없습니다.' }, { status: 400 });
      }
      if (t !== entryTimeMs) {
        entryTimeMs = t;
        data.entryTime = new Date(t);
        repriceNeeded = true;
      }
    }

    if (body.note !== undefined) {
      data.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    }

    if (body.pumpPhase !== undefined) {
      if (body.pumpPhase === null) {
        data.pumpPhase = null;
      } else if (typeof body.pumpPhase === 'string' && PUMP_PHASES.has(body.pumpPhase)) {
        data.pumpPhase = body.pumpPhase as PumpPhase;
      } else {
        return NextResponse.json({ error: '펌핑 단계 값이 올바르지 않습니다.' }, { status: 400 });
      }
    }

    if (body.isRealTrade !== undefined) {
      if (typeof body.isRealTrade !== 'boolean') {
        return NextResponse.json({ error: '실제 투자 여부 값이 올바르지 않습니다.' }, { status: 400 });
      }
      data.isRealTrade = body.isRealTrade;
    }

    if (body.endedAt !== undefined) {
      if (body.endedAt === null) {
        data.endedAt = null;
      } else {
        const t = Number(body.endedAt);
        if (!Number.isFinite(t)) {
          return NextResponse.json({ error: '종료 시각이 올바르지 않습니다.' }, { status: 400 });
        }
        data.endedAt = new Date(t);
      }
    }

    if (repriceNeeded) {
      const entryPrice = await resolveEntryPrice(symbol, entryTimeMs);
      const btcPriceAtEntry = symbol === 'BTCUSDT' ? entryPrice : await resolveEntryPrice('BTCUSDT', entryTimeMs);
      data.entryPrice = entryPrice;
      data.btcPriceAtEntry = btcPriceAtEntry;
    }

    // Symbol/entryTime changes move the whole window; ending or reopening
    // changes how far the window extends — either way the last snapshot is
    // stale, so re-capture it. Best-effort, same as on create.
    const chartRegenNeeded = repriceNeeded || body.endedAt !== undefined;

    const updated = await prisma.longShortEntry.update({ where: { id }, data });
    const updatedEntryTimeMs = updated.entryTime.getTime();
    const endTimeMs = updated.endedAt?.getTime() ?? null;

    let chartImageUrl = updated.chartImageUrl;
    if (chartRegenNeeded) {
      try {
        chartImageUrl = await generateAndStoreLsChart(updated);
      } catch (err) {
        console.error(`[ls] chart snapshot refresh failed for ${updated.id}:`, err);
      }
    }

    const [metrics, btcMetrics] = await Promise.all([
      computeLsMetrics(updated.symbol, updated.side, updatedEntryTimeMs, updated.entryPrice, endTimeMs),
      updated.btcPriceAtEntry != null
        ? computeLsMetrics('BTCUSDT', Side.LONG, updatedEntryTimeMs, updated.btcPriceAtEntry, endTimeMs)
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ...updated,
      entryTime: updatedEntryTimeMs,
      endedAt: endTimeMs,
      chartImageUrl,
      metrics,
      btcMetrics,
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.longShortEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
