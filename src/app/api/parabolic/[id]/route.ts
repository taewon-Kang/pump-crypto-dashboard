import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  candlesToTuples,
  computeParabolicMetrics,
  computeParabolicVolumesFromCandles,
  computeVolumeRatios,
  fetchParabolicCandles,
  pointsFromRow,
  serializeParabolicCase,
  validateExtraPoints,
  validateParabolicPoints,
} from '@/lib/parabolic';
import { REQUIRED_POINT_KEYS, SHAPE_TYPES, TIMEFRAME_OPTIONS, type ParabolicPoints, type ShapeType } from '@/types/parabolic';
import { ShapeType as PrismaShapeType } from '@/generated/prisma/enums';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseExtraPoint(body: any, key: 'baseLow' | 'parabolicStart'): { time: number; price: number } | null {
  const raw = body?.[key];
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
    const touchesStructure = body.points !== undefined || body.baseLow !== undefined || body.parabolicStart !== undefined;

    if (!touchesStructure) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {};
      if (body.notes !== undefined) data.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
      if (body.finalTopYn !== undefined) data.finalTopYn = typeof body.finalTopYn === 'boolean' ? body.finalTopYn : null;
      if (body.thirdWaveOccurred !== undefined)
        data.thirdWaveOccurred = typeof body.thirdWaveOccurred === 'boolean' ? body.thirdWaveOccurred : null;
      if (body.slopeCount !== undefined)
        data.slopeCount = Number.isFinite(Number(body.slopeCount)) && body.slopeCount !== null && body.slopeCount !== '' ? Math.round(Number(body.slopeCount)) : null;
      if (body.shapeType !== undefined)
        data.shapeType =
          typeof body.shapeType === 'string' && (SHAPE_TYPES as readonly string[]).includes(body.shapeType)
            ? PrismaShapeType[body.shapeType as ShapeType]
            : null;

      const row = await prisma.parabolicCase.update({ where: { id }, data });
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

    const existingBaseLow =
      existing.baseLowTime && existing.baseLowPrice != null
        ? { time: existing.baseLowTime.getTime(), price: existing.baseLowPrice }
        : null;
    const existingParabolicStart =
      existing.parabolicStartTime && existing.parabolicStartPrice != null
        ? { time: existing.parabolicStartTime.getTime(), price: existing.parabolicStartPrice }
        : null;
    const baseLow = body.baseLow === null ? null : parseExtraPoint(body, 'baseLow') ?? existingBaseLow;
    const parabolicStart =
      body.parabolicStart === null ? null : parseExtraPoint(body, 'parabolicStart') ?? existingParabolicStart;

    try {
      validateParabolicPoints(points);
      validateExtraPoints(points, baseLow, parabolicStart);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : '입력값을 확인해주세요.' }, { status: 400 });
    }

    const candles = await fetchParabolicCandles(symbol, timeframe, points);
    const volumes = computeParabolicVolumesFromCandles(candles, points);
    const metrics = { ...computeParabolicMetrics(points), volumeRatios: computeVolumeRatios(volumes) };

    const notes = body.notes !== undefined ? (typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null) : existing.notes;
    const finalTopYn =
      body.finalTopYn !== undefined ? (typeof body.finalTopYn === 'boolean' ? body.finalTopYn : null) : existing.finalTopYn;
    const thirdWaveOccurred =
      body.thirdWaveOccurred !== undefined
        ? typeof body.thirdWaveOccurred === 'boolean'
          ? body.thirdWaveOccurred
          : null
        : existing.thirdWaveOccurred;
    const slopeCount =
      body.slopeCount !== undefined
        ? Number.isFinite(Number(body.slopeCount)) && body.slopeCount !== null && body.slopeCount !== ''
          ? Math.round(Number(body.slopeCount))
          : null
        : existing.slopeCount;
    const shapeType =
      body.shapeType !== undefined
        ? typeof body.shapeType === 'string' && (SHAPE_TYPES as readonly string[]).includes(body.shapeType)
          ? PrismaShapeType[body.shapeType as ShapeType]
          : null
        : existing.shapeType;

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
        baseLowTime: baseLow ? new Date(baseLow.time) : null,
        baseLowPrice: baseLow ? baseLow.price : null,
        parabolicStartTime: parabolicStart ? new Date(parabolicStart.time) : null,
        parabolicStartPrice: parabolicStart ? parabolicStart.price : null,
        slopeCount,
        shapeType,
        ...volumes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles: candlesToTuples(candles) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metrics: metrics as any,
        thirdWaveOccurred,
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
