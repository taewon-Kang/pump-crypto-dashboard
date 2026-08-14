/**
 * Pure grouping logic: turns a time-ordered run of Binance Futures fills
 * for a single (symbol, direction) bucket into one or more position
 * "segments", tagging each fill ENTRY / ADD / PARTIAL_TP / CLOSE.
 *
 * A "bucket" is:
 *  - (symbol, 'LONG') or (symbol, 'SHORT') in hedge mode — Binance already
 *    tells us the direction via positionSide, and a hedge-mode bucket never
 *    flips: BUY always grows the LONG bucket / shrinks the SHORT bucket, SELL
 *    the reverse.
 *  - (symbol, 'BOTH') in one-way mode — a single net position that CAN flip
 *    direction (long -> short) if one fill's qty exceeds the remaining open
 *    size. That crossing case is handled by splitting the fill's effect
 *    across two segments (see the `synthetic` note below); the position math
 *    stays exact, only the audit trail for that one fill is slightly lossy
 *    (the closing leg keeps the DB fill row; the newly-opened leg's size is
 *    folded into the new segment's totals without its own row).
 *
 * No I/O here — this only computes; src/lib/binanceSync.ts does the
 * fetching and persisting.
 */

export type PositionSide = 'LONG' | 'SHORT';
export type FillEventType = 'ENTRY' | 'ADD' | 'PARTIAL_TP' | 'CLOSE';

const EPS = 1e-9;

export interface EngineFill {
  id: string; // BinanceFill DB row id
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  price: number;
  qty: number;
  realizedPnl: number;
  commission: number;
  commissionAsset: string;
  time: number; // epoch ms
}

/** Snapshot of an already-OPEN position to resume from, or null to start flat. */
export interface EngineResumeState {
  positionId: string;
  side: PositionSide;
  openedAt: number;
  entryQty: number;
  entryNotional: number;
  exitQty: number;
  exitNotional: number;
  realizedPnl: number;
  commission: number;
  commissionAsset: string | null;
}

export interface FillAssignment {
  fillId: string;
  eventType: FillEventType;
}

export interface Segment {
  /** Existing position id to update, or null to create a new BinancePosition. */
  resumeId: string | null;
  side: PositionSide;
  status: 'OPEN' | 'CLOSED';
  openedAt: number;
  closedAt: number | null;
  entryQty: number;
  entryNotional: number;
  exitQty: number;
  exitNotional: number;
  realizedPnl: number;
  commission: number;
  commissionAsset: string | null;
  fillAssignments: FillAssignment[];
}

function netQty(seg: Segment): number {
  return seg.entryQty - seg.exitQty;
}

/**
 * Processes `fills` (must already be sorted ascending by time, and already
 * scoped to one symbol + one bucket) starting from `initial`. Returns every
 * segment touched, in order — usually one, but a one-way-mode bucket that
 * flips direction mid-stream produces several.
 */
export function runPositionEngine(initial: EngineResumeState | null, fills: EngineFill[]): Segment[] {
  const segments: Segment[] = [];
  let cur: Segment | null = initial
    ? {
        resumeId: initial.positionId,
        side: initial.side,
        status: 'OPEN',
        openedAt: initial.openedAt,
        closedAt: null,
        entryQty: initial.entryQty,
        entryNotional: initial.entryNotional,
        exitQty: initial.exitQty,
        exitNotional: initial.exitNotional,
        realizedPnl: initial.realizedPnl,
        commission: initial.commission,
        commissionAsset: initial.commissionAsset,
        fillAssignments: [],
      }
    : null;

  function openNew(side: PositionSide, time: number) {
    cur = {
      resumeId: null,
      side,
      status: 'OPEN',
      openedAt: time,
      closedAt: null,
      entryQty: 0,
      entryNotional: 0,
      exitQty: 0,
      exitNotional: 0,
      realizedPnl: 0,
      commission: 0,
      commissionAsset: null,
      fillAssignments: [],
    };
  }

  function applyEntry(
    side: PositionSide,
    time: number,
    qty: number,
    price: number,
    realizedPnlPortion: number,
    commissionPortion: number,
    commissionAsset: string,
    fillId: string,
    eventType: FillEventType,
    recordAssignment: boolean
  ) {
    if (!cur) openNew(side, time);
    const seg = cur!;
    seg.entryQty += qty;
    seg.entryNotional += qty * price;
    seg.realizedPnl += realizedPnlPortion;
    seg.commission += commissionPortion;
    seg.commissionAsset ??= commissionAsset;
    if (recordAssignment) seg.fillAssignments.push({ fillId, eventType });
  }

  function applyExit(
    qty: number,
    price: number,
    realizedPnlPortion: number,
    commissionPortion: number,
    commissionAsset: string,
    fillId: string,
    eventType: FillEventType,
    time: number
  ) {
    const seg = cur!;
    seg.exitQty += qty;
    seg.exitNotional += qty * price;
    seg.realizedPnl += realizedPnlPortion;
    seg.commission += commissionPortion;
    seg.commissionAsset ??= commissionAsset;
    seg.fillAssignments.push({ fillId, eventType });
    if (netQty(seg) <= EPS) {
      seg.status = 'CLOSED';
      seg.closedAt = time;
      segments.push(seg);
      cur = null;
    }
  }

  for (const fill of fills) {
    if (fill.positionSide === 'LONG' || fill.positionSide === 'SHORT') {
      // Hedge mode: Binance already scopes this fill to one fixed-direction bucket.
      const bucketSide = fill.positionSide;
      const isIncrease = (bucketSide === 'LONG') === (fill.side === 'BUY');

      if (isIncrease) {
        const eventType: FillEventType = !cur || cur.entryQty === 0 ? 'ENTRY' : 'ADD';
        applyEntry(bucketSide, fill.time, fill.qty, fill.price, fill.realizedPnl, fill.commission, fill.commissionAsset, fill.id, eventType, true);
      } else if (!cur) {
        // Defensive: a reduceOnly fill with nothing open shouldn't happen on Binance's
        // side, but if it ever does, don't silently drop the fill — open a position
        // from it so the numbers stay reconcilable.
        applyEntry(bucketSide, fill.time, fill.qty, fill.price, fill.realizedPnl, fill.commission, fill.commissionAsset, fill.id, 'ENTRY', true);
      } else {
        const avail = netQty(cur);
        const closingQty = Math.min(fill.qty, avail);
        const remainder = fill.qty - closingQty;
        const eventType: FillEventType = avail - closingQty <= EPS ? 'CLOSE' : 'PARTIAL_TP';
        const ratio = closingQty / fill.qty;
        applyExit(closingQty, fill.price, fill.realizedPnl * ratio, fill.commission * ratio, fill.commissionAsset, fill.id, eventType, fill.time);
        if (remainder > EPS) {
          // Shouldn't happen in hedge mode (Binance rejects over-reducing a
          // positionSide-scoped position) — handled anyway for robustness.
          applyEntry(bucketSide, fill.time, remainder, fill.price, 0, fill.commission * (1 - ratio), fill.commissionAsset, fill.id, 'ENTRY', false);
        }
      }
      continue;
    }

    // One-way mode ('BOTH'): direction is relative to whatever is currently open.
    if (!cur) {
      const side: PositionSide = fill.side === 'BUY' ? 'LONG' : 'SHORT';
      applyEntry(side, fill.time, fill.qty, fill.price, fill.realizedPnl, fill.commission, fill.commissionAsset, fill.id, 'ENTRY', true);
      continue;
    }

    const sameDirection = (cur.side === 'LONG') === (fill.side === 'BUY');
    if (sameDirection) {
      applyEntry(cur.side, fill.time, fill.qty, fill.price, fill.realizedPnl, fill.commission, fill.commissionAsset, fill.id, 'ADD', true);
    } else {
      const avail = netQty(cur);
      const closingQty = Math.min(fill.qty, avail);
      const remainder = fill.qty - closingQty;
      const eventType: FillEventType = avail - closingQty <= EPS ? 'CLOSE' : 'PARTIAL_TP';
      const ratio = closingQty / fill.qty;
      applyExit(closingQty, fill.price, fill.realizedPnl * ratio, fill.commission * ratio, fill.commissionAsset, fill.id, eventType, fill.time);
      if (remainder > EPS) {
        // Position flip within a single fill: the leftover quantity opens a
        // brand-new position in the opposite direction. Its realizedPnl is 0
        // (nothing to realize on an opening trade); it gets a proportional
        // share of the commission. Not recorded as its own fill assignment —
        // its size lives only in the new segment's aggregate totals.
        const newSide: PositionSide = fill.side === 'BUY' ? 'LONG' : 'SHORT';
        applyEntry(newSide, fill.time, remainder, fill.price, 0, fill.commission * (1 - ratio), fill.commissionAsset, fill.id, 'ENTRY', false);
      }
    }
  }

  // Whatever is still open at the end is a real segment too (just not closed yet).
  if (cur) segments.push(cur);

  return segments;
}
