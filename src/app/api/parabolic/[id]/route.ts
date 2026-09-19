import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  computeParabolicMetrics,
  computeParabolicVolumes,
  pointsFromRow,
  serializeParabolicCase,
  validateParabolicPoints,
} from '@/lib/parabolic';
import { REQUIRED_POINT_KEYS, TIMEFRAME_OPTIONS, type ParabolicPoints } from '@/types/parabolic';

export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePoint(body: any, key: string): { time: number; price: number } | null {
  const raw = body?.points?.[key];
  if (!raw) return null;
  const time = Number(raw.time);
  const price = Number(raw.price);
  if (!Number.isFinite(time) || !Number.isFinite(price)) return null;
  return { time, price };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const existing = await prisma.parabolicCase.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: '기록을 찾을 수 없습니다.' }, { status: 404 });

    const body = await req.json();

    // Notes / final-top judgment can be patched alone without touching the points/volumes.
    if (body.points === undefined && (body.notes !== undefined || body.finalTopYn !== undefined)) {
      const row = await prisma.parabolicCase.update({
        where: { id },
        data: {
          ...(body.notes !== undefined
            ? { notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null }
            : {}),
          ...(body.finalTopYn !== undefined ? { finalTopYn: typeof body.finalTopYn === 'boolean' ? body.finalTopYn : null } : {}),
        },
      });
      return NextResponse.json(serializeParabolicCase(row));
    }

    const symbol = typeof body.symbol === 'string' ? body.symbol.toUpperCase() : existing.symbol;
    const timeframe = typeof body.timeframe === 'string' ? body.timeframe : existing.timeframe;
    if (!TIMEFRAME_OPTIONS.includes(timeframe)) {
      return NextResponse.json({ error: '시간봉을 선택해주세요.' }, { status: 400 });
    }

    const existingPoints = pointsFromRow(existing);
    const points = {
      l0: parsePoint(body, 'l0') ?? existingPoints.l0,
      h1: parsePoint(body, 'h1') ?? existingPoints.h1,
      l1: parsePoint(body, 'l1') ?? existingPoints.l1,
      h2: parsePoint(body, 'h2') ?? existingPoints.h2,
      l2: parsePoint(body, 'l2') ?? existingPoints.l2,
      h3: parsePoint(body, 'h3') ?? existingPoints.h3,
      l3: parsePoint(body, 'l3') ?? existingPoints.l3,
      r1: parsePoint(body, 'r1') ?? existingPoints.r1,
      l4: body.points?.l4 === null ? null : parsePoint(body, 'l4') ?? existingPoints.l4,
    } as ParabolicPoints;

    for (const key of REQUIRED_POINT_KEYS) {
      if (!points[key]) {
        return NextResponse.json({ error: `${key.toUpperCase()} 시각/가격을 입력해주세요.` }, { status: 400 });
      }
    }

    try {
      validateParabolicPoints(points);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : '입력값을 확인해주세요.' }, { status: 400 });
    }

    const [volumes, metrics] = await Promise.all([
      computeParabolicVolumes(symbol, timeframe, points),
      Promise.resolve(computeParabolicMetrics(points)),
    ]);

    const finalTopYn =
      body.finalTopYn !== undefined ? (typeof body.finalTopYn === 'boolean' ? body.finalTopYn : null) : existing.finalTopYn;
    const notes =
      body.notes !== undefined ? (typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null) : existing.notes;

    const row = await prisma.parabolicCase.update({
      where: { id },
      data: {
        symbol,
        timeframe,
        l0Time: new Date(points.l0.time),
        l0Price: points.l0.price,
        h1Time: new Date(points.h1.time),
        h1Price: points.h1.price,
        l1Time: new Date(points.l1.time),
        l1Price: points.l1.price,
        h2Time: new Date(points.h2.time),
        h2Price: points.h2.price,
        l2Time: new Date(points.l2.time),
        l2Price: points.l2.price,
        h3Time: new Date(points.h3.time),
        h3Price: points.h3.price,
        l3Time: new Date(points.l3.time),
        l3Price: points.l3.price,
        r1Time: new Date(points.r1.time),
        r1Price: points.r1.price,
        l4Time: points.l4 ? new Date(points.l4.time) : null,
        l4Price: points.l4 ? points.l4.price : null,
        ...volumes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metrics: metrics as any,
        finalTopYn,
        notes,
      },
    });

    return NextResponse.json(serializeParabolicCase(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.parabolicCase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
