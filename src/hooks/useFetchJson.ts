'use client';
import { useState, useEffect } from 'react';

/** Fetches and JSON-decodes `url`, re-fetching whenever it changes. Pass null to skip. */
export function useFetchJson<T>(url: string | null, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    // Standard fetch-on-effect idiom (see react.dev/learn/synchronizing-with-effects#fetching-data) —
    // resets loading/error before kicking off the request for this `url`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '알 수 없는 오류');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Reset to the "no fetch" state without touching setState inside the effect.
  if (!url) return { data: initial, loading: false, error: null };
  return { data, loading, error };
}
