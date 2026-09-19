import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { serializeParabolicCase } from '@/lib/parabolic';

export const maxDuration = 30;

// ExcelJS converts a Date to an Excel serial from its raw getTime() (UTC
// epoch ms), with no timezone awareness at all — so a plain `new Date(ms)`
// would render as UTC digits in Excel, not the KST wall-clock time the
// researcher actually typed into the (browser-local) datetime-local input.
// Shifting by +9h makes the UTC digits of the shifted instant equal the KST
// digits of the original one, which is what ends up displayed.
function kstDate(ms: number): Date {
  return new Date(ms + 9 * 60 * 60_000);
}

function yn(v: boolean | null): string {
  return v === true ? 'Y' : v === false ? 'N' : '';
}

export async function GET() {
  try {
    const rows = await prisma.parabolicCase.findMany({ orderBy: { l0Time: 'desc' } });
    const cases = rows.map(serializeParabolicCase);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Parabolic Cases');

    const dateFmt = 'yyyy-mm-dd hh:mm';
    ws.columns = [
      { header: 'Coin', key: 'symbol', width: 12 },
      { header: 'Exchange', key: 'exchange', width: 10 },
      { header: 'Timeframe', key: 'timeframe', width: 10 },
      { header: 'BaseLow_Time', key: 'baseLowTime', width: 17, style: { numFmt: dateFmt } },
      { header: 'BaseLow_Price', key: 'baseLowPrice', width: 14 },
      { header: 'ParabolicStart_Time', key: 'parabolicStartTime', width: 17, style: { numFmt: dateFmt } },
      { header: 'ParabolicStart_Price', key: 'parabolicStartPrice', width: 14 },
      { header: 'L0_Time', key: 'l0Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'L0_Price', key: 'l0Price', width: 14 },
      { header: 'H1_Time', key: 'h1Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'H1_Price', key: 'h1Price', width: 14 },
      { header: 'L1_Time', key: 'l1Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'L1_Price', key: 'l1Price', width: 14 },
      { header: 'H2_Time', key: 'h2Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'H2_Price', key: 'h2Price', width: 14 },
      { header: 'L2_Time', key: 'l2Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'L2_Price', key: 'l2Price', width: 14 },
      { header: 'H3_Time', key: 'h3Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'H3_Price', key: 'h3Price', width: 14 },
      { header: 'L3_Time', key: 'l3Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'L3_Price', key: 'l3Price', width: 14 },
      { header: 'R1_Time', key: 'r1Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'R1_Price', key: 'r1Price', width: 14 },
      { header: 'L4_Time', key: 'l4Time', width: 17, style: { numFmt: dateFmt } },
      { header: 'L4_Price', key: 'l4Price', width: 14 },
      { header: 'Rise1_Vol', key: 'rise1Vol', width: 16 },
      { header: 'Drop1_Vol', key: 'drop1Vol', width: 16 },
      { header: 'Rise2_Vol', key: 'rise2Vol', width: 16 },
      { header: 'Drop2_Vol', key: 'drop2Vol', width: 16 },
      { header: 'Rise3_Vol', key: 'rise3Vol', width: 16 },
      { header: 'PostDrop_Vol', key: 'postDropVol', width: 16 },
      { header: 'Rebound_Vol', key: 'reboundVol', width: 16 },
      { header: 'Rise2Vol_over_Rise1Vol', key: 'rise2OverRise1Vol', width: 20 },
      { header: 'Rise3Vol_over_Rise2Vol', key: 'rise3OverRise2Vol', width: 20 },
      { header: 'PostDropVol_over_Rise3Vol', key: 'postDropOverRise3Vol', width: 22 },
      { header: 'ReboundVol_over_PostDropVol', key: 'reboundOverPostDropVol', width: 24 },
      { header: 'Rise1_Pct', key: 'rise1Pct', width: 12 },
      { header: 'Drop1_Pct', key: 'drop1Pct', width: 12 },
      { header: 'Rise2_Pct', key: 'rise2Pct', width: 12 },
      { header: 'Drop2_Pct', key: 'drop2Pct', width: 12 },
      { header: 'Rise3_Pct', key: 'rise3Pct', width: 12 },
      { header: 'PostH3Drop_Pct', key: 'postDropPct', width: 14 },
      { header: 'Rebound_Pct', key: 'reboundPct', width: 13 },
      { header: 'NextDrop_Pct', key: 'nextDropPct', width: 13 },
      { header: 'Rise1_DurationHours', key: 'rise1Hours', width: 16 },
      { header: 'Drop1_DurationHours', key: 'drop1Hours', width: 16 },
      { header: 'Rise2_DurationHours', key: 'rise2Hours', width: 16 },
      { header: 'Drop2_DurationHours', key: 'drop2Hours', width: 16 },
      { header: 'Rise3_DurationHours', key: 'rise3Hours', width: 16 },
      { header: 'PostH3Drop_DurationHours', key: 'postDropHours', width: 20 },
      { header: 'Rebound_DurationHours', key: 'reboundHours', width: 18 },
      { header: 'NextDrop_DurationHours', key: 'nextDropHours', width: 18 },
      { header: 'Rise1_Slope', key: 'rise1Slope', width: 12 },
      { header: 'Drop1_Slope', key: 'drop1Slope', width: 12 },
      { header: 'Rise2_Slope', key: 'rise2Slope', width: 12 },
      { header: 'Drop2_Slope', key: 'drop2Slope', width: 12 },
      { header: 'Rise3_Slope', key: 'rise3Slope', width: 12 },
      { header: 'PostH3Drop_Slope', key: 'postDropSlope', width: 14 },
      { header: 'Rebound_Slope', key: 'reboundSlope', width: 13 },
      { header: 'RiseSlopeRatio_2_1', key: 'riseSlopeRatio21', width: 16 },
      { header: 'RiseSlopeRatio_3_2', key: 'riseSlopeRatio32', width: 16 },
      { header: 'RisePctRatio_2_1', key: 'risePctRatio21', width: 15 },
      { header: 'RisePctRatio_3_2', key: 'risePctRatio32', width: 15 },
      { header: 'Retrace1_Pct', key: 'retrace1Pct', width: 13 },
      { header: 'Retrace2_Pct', key: 'retrace2Pct', width: 13 },
      { header: 'H2_Breakout_over_H1_Pct', key: 'h2BreakoutPct', width: 20 },
      { header: 'H3_Breakout_over_H2_Pct', key: 'h3BreakoutPct', width: 20 },
      { header: 'TotalRise_L0_to_H3_Pct', key: 'totalRiseToH3Pct', width: 18 },
      { header: 'Duration_L0_to_H3_Hours', key: 'durationToH3Hours', width: 20 },
      { header: 'TotalDuration_Hours', key: 'totalDurationHours', width: 18 },
      { header: 'SweepDepth_Pct', key: 'sweepDepthPct', width: 14 },
      { header: 'RecoveryRatio_Pct', key: 'recoveryRatioPct', width: 16 },
      { header: 'R1_over_H3_Pct', key: 'r1OverH3Pct', width: 14 },
      { header: 'L1_vs_L0_Pct', key: 'l1VsL0Pct', width: 13 },
      { header: 'L2_vs_L1_Pct', key: 'l2VsL1Pct', width: 13 },
      { header: 'L3_vs_L0_Pct', key: 'l3VsL0Pct', width: 13 },
      { header: 'SlopeCount', key: 'slopeCount', width: 11 },
      { header: 'ShapeType', key: 'shapeType', width: 11 },
      { header: 'ThirdWaveOccurred_YN', key: 'thirdWaveOccurred', width: 18 },
      { header: 'FinalTop_YN', key: 'finalTopYn', width: 12 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const c of cases) {
      const { points, metrics } = c;
      ws.addRow({
        symbol: c.symbol,
        exchange: c.exchange,
        timeframe: c.timeframe,
        baseLowTime: c.baseLow ? kstDate(c.baseLow.time) : null,
        baseLowPrice: c.baseLow?.price ?? null,
        parabolicStartTime: c.parabolicStart ? kstDate(c.parabolicStart.time) : null,
        parabolicStartPrice: c.parabolicStart?.price ?? null,
        l0Time: kstDate(points.l0.time),
        l0Price: points.l0.price,
        h1Time: kstDate(points.h1.time),
        h1Price: points.h1.price,
        l1Time: kstDate(points.l1.time),
        l1Price: points.l1.price,
        h2Time: kstDate(points.h2.time),
        h2Price: points.h2.price,
        l2Time: kstDate(points.l2.time),
        l2Price: points.l2.price,
        h3Time: kstDate(points.h3.time),
        h3Price: points.h3.price,
        l3Time: kstDate(points.l3.time),
        l3Price: points.l3.price,
        r1Time: kstDate(points.r1.time),
        r1Price: points.r1.price,
        l4Time: points.l4 ? kstDate(points.l4.time) : null,
        l4Price: points.l4 ? points.l4.price : null,
        rise1Vol: c.rise1Vol,
        drop1Vol: c.drop1Vol,
        rise2Vol: c.rise2Vol,
        drop2Vol: c.drop2Vol,
        rise3Vol: c.rise3Vol,
        postDropVol: c.postDropVol,
        reboundVol: c.reboundVol,
        rise2OverRise1Vol: round(metrics.volumeRatios.rise2OverRise1),
        rise3OverRise2Vol: round(metrics.volumeRatios.rise3OverRise2),
        postDropOverRise3Vol: round(metrics.volumeRatios.postDropOverRise3),
        reboundOverPostDropVol: round(metrics.volumeRatios.reboundOverPostDrop),
        rise1Pct: round(metrics.legs.l0ToH1.pct),
        drop1Pct: round(metrics.legs.h1ToL1.pct),
        rise2Pct: round(metrics.legs.l1ToH2.pct),
        drop2Pct: round(metrics.legs.h2ToL2.pct),
        rise3Pct: round(metrics.legs.l2ToH3.pct),
        postDropPct: round(metrics.legs.h3ToL3.pct),
        reboundPct: round(metrics.legs.l3ToR1.pct),
        nextDropPct: metrics.legs.r1ToL4 ? round(metrics.legs.r1ToL4.pct) : null,
        rise1Hours: round(metrics.legs.l0ToH1.durationHours),
        drop1Hours: round(metrics.legs.h1ToL1.durationHours),
        rise2Hours: round(metrics.legs.l1ToH2.durationHours),
        drop2Hours: round(metrics.legs.h2ToL2.durationHours),
        rise3Hours: round(metrics.legs.l2ToH3.durationHours),
        postDropHours: round(metrics.legs.h3ToL3.durationHours),
        reboundHours: round(metrics.legs.l3ToR1.durationHours),
        nextDropHours: metrics.legs.r1ToL4 ? round(metrics.legs.r1ToL4.durationHours) : null,
        rise1Slope: round(metrics.legs.l0ToH1.slope, 5),
        drop1Slope: round(metrics.legs.h1ToL1.slope, 5),
        rise2Slope: round(metrics.legs.l1ToH2.slope, 5),
        drop2Slope: round(metrics.legs.h2ToL2.slope, 5),
        rise3Slope: round(metrics.legs.l2ToH3.slope, 5),
        postDropSlope: round(metrics.legs.h3ToL3.slope, 5),
        reboundSlope: round(metrics.legs.l3ToR1.slope, 5),
        riseSlopeRatio21: round(metrics.riseSlopeRatio21),
        riseSlopeRatio32: round(metrics.riseSlopeRatio32),
        risePctRatio21: round(metrics.risePctRatio21),
        risePctRatio32: round(metrics.risePctRatio32),
        retrace1Pct: round(metrics.retracement1Pct),
        retrace2Pct: round(metrics.retracement2Pct),
        h2BreakoutPct: round(metrics.h2BreakoutOverH1Pct),
        h3BreakoutPct: round(metrics.h3BreakoutOverH2Pct),
        totalRiseToH3Pct: round(metrics.totalRiseL0ToH3Pct),
        durationToH3Hours: round(metrics.durationL0ToH3Hours),
        totalDurationHours: round(metrics.totalDurationHours),
        sweepDepthPct: round(metrics.sweepDepthPct),
        recoveryRatioPct: round(metrics.recoveryRatioPct),
        r1OverH3Pct: round(metrics.r1OverH3Pct),
        l1VsL0Pct: round(metrics.l1VsL0Pct),
        l2VsL1Pct: round(metrics.l2VsL1Pct),
        l3VsL0Pct: round(metrics.l3VsL0Pct),
        slopeCount: c.slopeCount ?? '',
        shapeType: c.shapeType ?? '',
        thirdWaveOccurred: yn(c.thirdWaveOccurred),
        finalTopYn: yn(c.finalTopYn),
        notes: c.notes ?? '',
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `parabolic_cases_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function round(n: number | null, digits = 2): number | null {
  if (n === null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
