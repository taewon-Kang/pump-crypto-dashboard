import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  computeParabolicMetrics,
  computeParabolicVolumes,
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

export async function GET() {
  try {
    const rows = await prisma.parabolicCase.findMany({ orderBy: { l0Time: 'desc' } });
    return NextResponse.json(rows.map(serializeParabolicCase), {
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
    const timeframe = typeof body.timeframe === 'string' ? body.timeframe : '';
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null;
    const finalTopYn = typeof body.finalTopYn === 'boolean' ? body.finalTopYn : null;

    if (!symbol) {
      return NextResponse.json({ error: '코인을 선택해주세요.' }, { status: 400 });
    }
    if (!TIMEFRAME_OPTIONS.includes(timeframe)) {
      return NextResponse.json({ error: '시간봉을 선택해주세요.' }, { status: 400 });
    }

    const points = {
      l0: parsePoint(body, 'l0'),
      h1: parsePoint(body, 'h1'),
      l1: parsePoint(body, 'l1'),
      h2: parsePoint(body, 'h2'),
      l2: parsePoint(body, 'l2'),
      h3: parsePoint(body, 'h3'),
      l3: parsePoint(body, 'l3'),
      r1: parsePoint(body, 'r1'),
      l4: parsePoint(body, 'l4'),
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

    const row = await prisma.parabolicCase.create({
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
