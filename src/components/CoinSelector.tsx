'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import LoadingDots from '@/components/LoadingDots';

interface CoinInfo {
  symbol: string;
  baseAsset: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function CoinSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coins, setCoins] = useState<CoinInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/coins')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCoins(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      // Clear the search box whenever the dropdown closes, regardless of which
      // of the several close paths (outside click, Escape, select, toggle) fired.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch('');
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const filtered = coins.filter(
    (c) =>
      c.baseAsset.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase())
  );

  const selected = coins.find((c) => c.symbol === value);
  const displayLabel = selected
    ? `${selected.baseAsset}/USDT`
    : `${value.replace('USDT', '')}/USDT`;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-[#1A2035] border border-[#2D3748] text-gray-100 rounded-lg px-3 py-2 text-sm font-semibold hover:border-[#4A5568] transition-colors min-w-[148px] justify-between"
      >
        <span>{displayLabel}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-72 bg-[#0F1629] border border-[#2D3748] rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-[#1F2937]">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search coins..."
                className="w-full bg-[#111827] border border-[#374151] rounded-lg py-1.5 pl-8 pr-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Coin List */}
          <div ref={listRef} className="max-h-64 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="py-8 text-center text-sm text-gray-500">
                <div className="flex justify-center mb-2">
                  <LoadingDots size="sm" />
                </div>
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No results for &quot;{search}&quot;</div>
            ) : (
              filtered.map((coin) => {
                const isActive = coin.symbol === value;
                return (
                  <button
                    key={coin.symbol}
                    onClick={() => {
                      onChange(coin.symbol);
                      close();
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                      isActive
                        ? 'bg-blue-600/10 text-blue-400'
                        : 'text-gray-300 hover:bg-[#1A2035] hover:text-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs font-bold w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-blue-600/30 text-blue-300' : 'bg-[#1F2937] text-gray-400'
                        }`}
                      >
                        {coin.baseAsset.slice(0, 2)}
                      </span>
                      <div>
                        <p className="font-medium leading-none">{coin.baseAsset}/USDT</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Perpetual</p>
                      </div>
                    </div>
                    {isActive && (
                      <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count */}
          {!loading && (
            <div className="px-4 py-2 border-t border-[#1F2937] text-[11px] text-gray-600">
              {filtered.length} / {coins.length} pairs
            </div>
          )}
        </div>
      )}
    </div>
  );
}
