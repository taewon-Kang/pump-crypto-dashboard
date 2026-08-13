import path from 'node:path';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { put } from '@vercel/blob';
import { fetchKlinesRange } from '@/lib/binance';
import { formatPrice } from '@/lib/format';
import { CHART_COLORS } from '@/lib/chart';
import { prisma } from '@/lib/prisma';
import type { Side } from '@/generated/prisma/enums';

const DAY_MS = 86_400_000;
// Context window around the call: enough pre-entry history to see the setup,
// capped post-entry so a still-open trade doesn't grow the image forever.
const DAYS_BEFORE = 60;
const DAYS_AFTER_CAP = 120;

const WIDTH = 1100;
const HEIGHT = 520;
const PAD = { top: 66, right: 90, bottom: 40, left: 16 };

const AMBER = '#F59E0B';
const GRAY_LINE = '#6B7280';

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), 'src', 'assets', 'fonts');
  GlobalFonts.registerFromPath(path.join(dir, 'DejaVuSans.ttf'), 'Chart Sans');
  GlobalFonts.registerFromPath(path.join(dir, 'DejaVuSans-Bold.ttf'), 'Chart Sans Bold');
  fontsRegistered = true;
}

export interface ChartSnapshotInput {
  symbol: string;
  side: Side;
  entryTimeMs: number;
  entryPrice: number;
  /** null while still open — the window then extends up to "now". */
  endedAtMs: number | null;
}

/** Renders a daily-candle PNG snapshot for the market context around an L/S call. */
export async function renderLsChartPng(input: ChartSnapshotInput): Promise<Buffer> {
  ensureFonts();

  const { symbol, side, entryTimeMs, entryPrice, endedAtMs } = input;
  const startTime = entryTimeMs - DAYS_BEFORE * DAY_MS;
  const rawEnd = endedAtMs ?? Date.now();
  const endTime = Math.min(rawEnd, entryTimeMs + DAYS_AFTER_CAP * DAY_MS) + DAY_MS;

  const candles = await fetchKlinesRange(symbol, '1d', 'futures', startTime, endTime, 1500);
  if (candles.length < 2) {
    throw new Error(`${symbol}: 차트를 그리기에 캔들 데이터가 부족합니다.`);
  }

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = CHART_COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const plotX0 = PAD.left;
  const plotX1 = WIDTH - PAD.right;
  const plotY0 = PAD.top;
  const plotY1 = HEIGHT - PAD.bottom;
  const plotW = plotX1 - plotX0;
  const plotH = plotY1 - plotY0;

  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (const c of candles) {
    if (c.low < priceMin) priceMin = c.low;
    if (c.high > priceMax) priceMax = c.high;
  }
  const pricePad = (priceMax - priceMin) * 0.08 || priceMax * 0.01 || 1;
  priceMin -= pricePad;
  priceMax += pricePad;

  const scaleY = (price: number) => plotY1 - ((price - priceMin) / (priceMax - priceMin)) * plotH;
  const n = candles.length;
  const slot = plotW / n;

  // Horizontal grid + price labels (5 lines)
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.font = '13px "Chart Sans"';
  ctx.fillStyle = CHART_COLORS.text;
  ctx.textBaseline = 'middle';
  const GRID_LINES = 5;
  for (let i = 0; i <= GRID_LINES; i++) {
    const price = priceMin + ((priceMax - priceMin) * i) / GRID_LINES;
    const y = scaleY(price);
    ctx.beginPath();
    ctx.moveTo(plotX0, y);
    ctx.lineTo(plotX1, y);
    ctx.stroke();
    ctx.fillText(formatPrice(price), plotX1 + 10, y);
  }

  // Vertical date ticks (~6 labels across the range)
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const TICKS = Math.min(6, n);
  for (let i = 0; i < TICKS; i++) {
    const idx = Math.round((i * (n - 1)) / Math.max(1, TICKS - 1));
    const c = candles[idx];
    const x = plotX0 + idx * slot + slot / 2;
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(x, plotY0);
    ctx.lineTo(x, plotY1);
    ctx.stroke();
    const d = new Date(c.timestamp);
    const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    ctx.fillStyle = CHART_COLORS.text;
    ctx.fillText(label, x, plotY1 + 8);
  }
  ctx.textAlign = 'left';

  // Border around the plot area
  ctx.strokeStyle = CHART_COLORS.border;
  ctx.strokeRect(plotX0, plotY0, plotW, plotH);

  // Candles
  const bodyW = Math.max(2, slot * 0.62);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = plotX0 + i * slot + slot / 2;
    const up = c.close >= c.open;
    const color = up ? CHART_COLORS.up : CHART_COLORS.down;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, scaleY(c.high));
    ctx.lineTo(x, scaleY(c.low));
    ctx.stroke();
    const openY = scaleY(c.open);
    const closeY = scaleY(c.close);
    const top = Math.min(openY, closeY);
    const h = Math.max(1, Math.abs(closeY - openY));
    ctx.fillRect(x - bodyW / 2, top, bodyW, h);
  }

  // Entry marker: nearest candle at/before entryTimeMs
  function nearestIndex(t: number): number {
    let idx = 0;
    for (let i = 0; i < n; i++) {
      if (candles[i].timestamp > t) break;
      idx = i;
    }
    return idx;
  }
  function drawTimeMarker(idx: number, label: string, color: string) {
    const x = plotX0 + idx * slot + slot / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, plotY0);
    ctx.lineTo(x, plotY1);
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 12px "Chart Sans Bold"';
    const textW = ctx.measureText(label).width;
    const bx = Math.min(Math.max(x - textW / 2 - 6, plotX0), plotX1 - textW - 12);
    ctx.fillStyle = color;
    ctx.fillRect(bx, plotY0 - 16, textW + 12, 16);
    ctx.fillStyle = '#0B0E1A';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + 6, plotY0 - 8);
  }

  const entryIdx = nearestIndex(entryTimeMs);
  drawTimeMarker(entryIdx, 'ENTRY', AMBER);

  // Entry price level
  const entryY = scaleY(entryPrice);
  ctx.save();
  ctx.strokeStyle = AMBER;
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotX0, entryY);
  ctx.lineTo(plotX1, entryY);
  ctx.stroke();
  ctx.restore();
  ctx.font = 'bold 12px "Chart Sans Bold"';
  ctx.fillStyle = AMBER;
  ctx.textBaseline = 'middle';
  ctx.fillText(formatPrice(entryPrice), plotX1 + 10, entryY - 14);

  if (endedAtMs !== null && endedAtMs <= candles[n - 1].timestamp + DAY_MS) {
    drawTimeMarker(nearestIndex(endedAtMs), 'END', GRAY_LINE);
  }

  // Header
  ctx.textBaseline = 'alphabetic';
  const symLabel = symbol.replace('USDT', '/USDT');
  ctx.font = 'bold 20px "Chart Sans Bold"';
  const symW = ctx.measureText(symLabel).width;
  ctx.fillStyle = '#F3F4F6';
  ctx.fillText(symLabel, plotX0, 30);

  const sideLabel = side === 'LONG' ? 'LONG' : 'SHORT';
  const sideColor = side === 'LONG' ? CHART_COLORS.up : CHART_COLORS.down;
  ctx.font = 'bold 14px "Chart Sans Bold"';
  ctx.fillStyle = sideColor;
  ctx.fillText(sideLabel, plotX0 + symW + 14, 29);

  ctx.font = '12px "Chart Sans"';
  ctx.fillStyle = CHART_COLORS.text;
  const entryDate = new Date(entryTimeMs);
  const dateStr = entryDate.toISOString().slice(0, 16).replace('T', ' ');
  // Chart is rendered with a Latin-only font (no Hangul glyphs), so this
  // in-image subtitle stays in English even though the rest of the app is
  // Korean — the surrounding UI (LsEntryCard) already shows Korean labels.
  ctx.fillText(`Daily · Entry ${dateStr} UTC · Entry price ${formatPrice(entryPrice)}`, plotX0, 48);

  return canvas.toBuffer('image/png');
}

export interface LsEntryLike {
  id: string;
  symbol: string;
  side: Side;
  entryTime: Date;
  entryPrice: number;
  endedAt: Date | null;
}

/**
 * Renders this entry's daily-candle snapshot, uploads it to Vercel Blob, and
 * persists the resulting URL on the row. Fixed pathname (per entry id) so
 * regenerating — e.g. after the trade ends and the window grows — overwrites
 * the previous image instead of leaking orphaned blobs.
 */
export async function generateAndStoreLsChart(entry: LsEntryLike): Promise<string> {
  const png = await renderLsChartPng({
    symbol: entry.symbol,
    side: entry.side,
    entryTimeMs: entry.entryTime.getTime(),
    entryPrice: entry.entryPrice,
    endedAtMs: entry.endedAt?.getTime() ?? null,
  });

  const blob = await put(`ls-charts/${entry.id}.png`, png, {
    access: 'public',
    contentType: 'image/png',
    allowOverwrite: true,
  });

  await prisma.longShortEntry.update({
    where: { id: entry.id },
    data: { chartImageUrl: blob.url },
  });

  return blob.url;
}
