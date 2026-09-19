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

export async function GET() {
  try {
    const rows = await prisma.parabolicCase.findMany({ orderBy: { l0Time: 'desc' } });
    const cases = rows.map(serializeParabolicCase);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Parabolic Cases');

    const dateFmt = 'yyyy-mm-dd hh:mm';
    ws.columns = [
      { header: 'Coin', key: 'symbol', width: 12 },
      { header: 'Timeframe', key: 'timeframe', width: 10 },
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
      { header: 'Rise1_Pct', key: 'rise1Pct', width: 12 },
      { header: 'Drop1_Pct', key: 'drop1Pct', width: 12 },
      { header: 'Rise2_Pct', key: 'rise2Pct', width: 12 },
      { header: 'Drop2_Pct', key: 'drop2Pct', width: 12 },
      { header: 'Rise3_Pct', key: 'rise3Pct', width: 12 },
      { header: 'PostDrop_Pct', key: 'postDropPct', width: 13 },
      { header: 'Rebound_Pct', key: 'reboundPct', width: 13 },
      { header: 'NextDrop_Pct', key: 'nextDropPct', width: 13 },
      { header: 'TotalRise_Pct', key: 'totalRisePct', width: 14 },
      { header: 'TotalDuration_Hours', key: 'totalDurationHours', width: 18 },
      { header: 'Retrace1_Pct', key: 'retrace1Pct', width: 13 },
      { header: 'Retrace2_Pct', key: 'retrace2Pct', width: 13 },
      { header: 'ReboundRetrace_Pct', key: 'reboundRetracePct', width: 18 },
      { header: 'L1_vs_L0_Pct', key: 'l1VsL0Pct', width: 13 },
      { header: 'L2_vs_L1_Pct', key: 'l2VsL1Pct', width: 13 },
      { header: 'L3_vs_L0_Pct', key: 'l3VsL0Pct', width: 13 },
      { header: 'FinalTop_YN', key: 'finalTopYn', width: 12 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const c of cases) {
      const { points, metrics } = c;
      ws.addRow({
        symbol: c.symbol,
        timeframe: c.timeframe,
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
        rise1Pct: round2(metrics.legs.l0ToH1.pct),
        drop1Pct: round2(metrics.legs.h1ToL1.pct),
        rise2Pct: round2(metrics.legs.l1ToH2.pct),
        drop2Pct: round2(metrics.legs.h2ToL2.pct),
        rise3Pct: round2(metrics.legs.l2ToH3.pct),
        postDropPct: round2(metrics.legs.h3ToL3.pct),
        reboundPct: round2(metrics.legs.l3ToR1.pct),
        nextDropPct: metrics.legs.r1ToL4 ? round2(metrics.legs.r1ToL4.pct) : null,
        totalRisePct: round2(metrics.totalRisePct),
        totalDurationHours: round2(metrics.totalDurationHours),
        retrace1Pct: round2(metrics.retrace1Pct),
        retrace2Pct: round2(metrics.retrace2Pct),
        reboundRetracePct: round2(metrics.reboundRetracePct),
        l1VsL0Pct: round2(metrics.l1VsL0Pct),
        l2VsL1Pct: round2(metrics.l2VsL1Pct),
        l3VsL0Pct: round2(metrics.l3VsL0Pct),
        finalTopYn: c.finalTopYn === true ? 'Y' : c.finalTopYn === false ? 'N' : '',
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
