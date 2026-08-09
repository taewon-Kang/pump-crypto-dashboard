'use client';
import { MergedData, Interval } from '@/types';
import { useFetchJson } from './useFetchJson';

export function useMarketData(symbol: string, interval: Interval) {
  return useFetchJson<MergedData[]>(`/api/klines?symbol=${symbol}&interval=${interval}`, []);
}
