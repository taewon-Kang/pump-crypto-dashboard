'use client';
import { useCallback, useRef } from 'react';
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts';

/**
 * Wires a lightweight-charts instance's crosshair-move event to an
 * absolutely-positioned legend overlay, writing HTML directly through a ref
 * (not React state) so mouse-move-frequency updates don't trigger re-renders.
 */
export function useChartLegend() {
  const legendRef = useRef<HTMLDivElement>(null);

  const setHtml = useCallback((html: string) => {
    if (legendRef.current) legendRef.current.innerHTML = html;
  }, []);

  /** Subscribes `render` to the chart's crosshair moves; `param` is null while not hovering. */
  const attach = useCallback(
    (chart: IChartApi, render: (param: MouseEventParams<Time> | null) => string) => {
      chart.subscribeCrosshairMove((param) => {
        const hovering = param.time && param.point;
        setHtml(render(hovering ? param : null));
      });
    },
    [setHtml]
  );

  return { legendRef, setHtml, attach };
}
