import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAllLatestPrices } from '@/lib/binance';
import type { BinancePositionDto, BinancePositionsResponse } from '@/types/binance';

export async function GET() {
  try {
    const [positions, meta] = await Promise.all([
      prisma.binancePosition.findMany({
        orderBy: { openedAt: 'desc' },
        include: {
          fills: { orderBy: { time: 'asc' } },
          observations: { orderBy: { checkpoint: 'asc' } },
          linkedLsEntry: { select: { id: true, symbol: true, side: true, entryTime: true } },
        },
      }),
      prisma.binanceSyncMeta.findUnique({ where: { id: 1 } }),
    ]);

    const openSymbols = [...new Set(positions.filter((p) => p.status === 'OPEN').map((p) => p.symbol))];
    const livePrices: Record<string, number> = openSymbols.length
      ? await fetchAllLatestPrices('futures').catch(() => ({}))
      : {};

    const dtos: BinancePositionDto[] = positions.map((p) => {
      const avgEntryPrice = p.entryQty > 0 ? p.entryNotional / p.entryQty : 0;
      const avgExitPrice = p.exitQty > 0 ? p.exitNotional / p.exitQty : null;
      const closedAtMs = p.closedAt?.getTime() ?? null;
      const holdingSeconds = Math.max(0, ((closedAtMs ?? Date.now()) - p.openedAt.getTime()) / 1000);

      const currentPrice = p.status === 'OPEN' ? (livePrices[p.symbol] ?? null) : null;
      const openQty = p.entryQty - p.exitQty;
      const unrealizedPnl =
        currentPrice !== null && openQty > 0
          ? (currentPrice - avgEntryPrice) * openQty * (p.side === 'LONG' ? 1 : -1)
          : null;

      return {
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        status: p.status,
        openedAt: p.openedAt.getTime(),
        closedAt: closedAtMs,
        avgEntryPrice,
        avgExitPrice,
        entryQty: p.entryQty,
        exitQty: p.exitQty,
        realizedPnl: p.realizedPnl,
        commission: p.commission,
        commissionAsset: p.commissionAsset,
        leverage: p.leverage,
        holdingSeconds,
        currentPrice,
        unrealizedPnl,
        linkedLsEntryId: p.linkedLsEntryId,
        linkedLsEntry: p.linkedLsEntry
          ? {
              id: p.linkedLsEntry.id,
              symbol: p.linkedLsEntry.symbol,
              side: p.linkedLsEntry.side,
              entryTime: p.linkedLsEntry.entryTime.getTime(),
            }
          : null,
        fills: p.fills.map((f) => ({
          id: f.id,
          side: f.side as 'BUY' | 'SELL',
          positionSide: f.positionSide as 'LONG' | 'SHORT' | 'BOTH',
          price: f.price,
          qty: f.qty,
          quoteQty: f.quoteQty,
          realizedPnl: f.realizedPnl,
          commission: f.commission,
          commissionAsset: f.commissionAsset,
          isMaker: f.isMaker,
          time: f.time.getTime(),
          eventType: f.eventType,
        })),
        observations: p.observations.map((o) => ({
          checkpoint: o.checkpoint as '3d' | '7d' | '14d' | '30d',
          observedAt: o.observedAt.getTime(),
          price: o.price,
          returnPct: o.returnPct,
        })),
      };
    });

    const body: BinancePositionsResponse = {
      positions: dtos,
      sync: {
        lastRunAt: meta?.lastRunAt?.getTime() ?? null,
        lastRunStatus: meta?.lastRunStatus ?? null,
        lastError: meta?.lastError ?? null,
      },
    };

    return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
