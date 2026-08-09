import type { Exchange } from '@/types/performance';

/** Adaptive price formatter with a currency prefix — $ for Binance/USDT, ₩ for Upbit/KRW. */
export function formatPrice(v: number, exchange: Exchange = 'binance'): string {
  if (exchange === 'upbit') {
    if (v >= 1000) return '₩' + Math.round(v).toLocaleString('ko-KR');
    if (v >= 1) return '₩' + v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
    return '₩' + v.toPrecision(4);
  }
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1) return '$' + v.toFixed(4);
  if (v <= 0) return '$0';
  const mag = Math.abs(Math.floor(Math.log10(v)));
  return '$' + v.toFixed(Math.min(10, mag + 4));
}

/** Compact volume formatter: 1.23B / 4.5M / 12.3K. */
export function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}

/** lightweight-charts priceFormat tuned to a price's magnitude (more decimals for sub-$1 coins). */
export function getPriceFormat(price: number): { type: 'price'; precision: number; minMove: number } {
  if (!price || price <= 0) return { type: 'price', precision: 2, minMove: 0.01 };
  if (price >= 100) return { type: 'price', precision: 2, minMove: 0.01 };
  if (price >= 1) return { type: 'price', precision: 4, minMove: 0.0001 };
  // Sub-1 prices: find significant digit position and show 3+ digits
  const magnitude = Math.abs(Math.floor(Math.log10(price)));
  const precision = Math.min(10, magnitude + 3);
  const minMove = parseFloat(`1e-${precision}`);
  return { type: 'price', precision, minMove };
}

/** Short ko-KR timestamp used in chart hover legends. */
export function formatLegendTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
