import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// The only mutation this real-trade view allows: manually linking/unlinking
// a synced Binance position to a hand-logged L/S Tracker entry. Every other
// field on BinancePosition is a read-only mirror of exchange data.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!('linkedLsEntryId' in body)) {
      return NextResponse.json({ error: 'linkedLsEntryId가 필요합니다.' }, { status: 400 });
    }
    const linkedLsEntryId = typeof body.linkedLsEntryId === 'string' ? body.linkedLsEntryId : null;

    const updated = await prisma.binancePosition.update({
      where: { id },
      data: { linkedLsEntryId },
    });

    return NextResponse.json({ id: updated.id, linkedLsEntryId: updated.linkedLsEntryId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
