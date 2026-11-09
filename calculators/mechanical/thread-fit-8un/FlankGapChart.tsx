'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlankFit } from './strength';

/**
 * Axial flank gaps along the engaged threads under the working load
 * (full-load stretch model, first engaged thread bearing).
 *   back flank   g_b(x) = a + p − ε·x   (per pair)
 *   loaded flank g_l(x) = ε·x          (same for both pairs)
 * Negative back-flank gap = interference.
 */

// dataviz reference palette, categorical slots 1–3 (validated for these surfaces)
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a'],
  dark: ['#3987e5', '#d95926', '#199e70'],
};
const CRITICAL = '#d03b3b';

interface Props {
  fits: { MMC: FlankFit; LMC: FlankFit };
  /** Strain in the engaged thread */
  eps: number;
  /** Engaged length [in] and pitch [in] */
  LE: number;
  P: number;
  unit: 'in' | 'mm';
  dark: boolean;
}

interface Row {
  x: number;
  thread: number;
  backMMC: number;
  backLMC: number;
  loaded: number;
}

export function FlankGapChart({ fits, eps, LE, P, unit, dark }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(280, el.clientWidth)));
    ro.observe(el);
    setWidth(Math.max(280, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // display unit: 0.001 in or µm
  const f = unit === 'in' ? 1000 : 25400;
  const unitLabel = unit === 'in' ? '0.001 in' : 'µm';
  const colors = dark ? SERIES.dark : SERIES.light;

  const rows: Row[] = useMemo(() => {
    const n = Math.floor(LE / P + 1e-9);
    const xs: number[] = [];
    for (let i = 0; i <= n; i++) xs.push(i * P);
    if (LE - n * P > 1e-6) xs.push(LE);
    return xs.map((x) => ({
      x,
      thread: x / P + 1,
      backMMC: (fits.MMC.a + fits.MMC.p - eps * x) * f,
      backLMC: (fits.LMC.a + fits.LMC.p - eps * x) * f,
      loaded: eps * x * f,
    }));
  }, [fits, eps, LE, P, f]);

  const series = [
    { key: 'backMMC' as const, name: 'Back flank · MMC pair', color: colors[0] },
    { key: 'backLMC' as const, name: 'Back flank · LMC pair', color: colors[1] },
    { key: 'loaded' as const, name: 'Loaded flank · both pairs', color: colors[2] },
  ];

  const H = 250;
  const m = { l: 58, r: 112, t: 14, b: 36 };
  const pw = Math.max(80, width - m.l - m.r);
  const ph = H - m.t - m.b;
  const all = rows.flatMap((r) => [r.backMMC, r.backLMC, r.loaded]);
  const hi = Math.max(...all, 0);
  const lo0 = Math.min(...all, 0);
  const span = hi - lo0 || 1;
  // always leave room below zero for the interference zone
  const lo = Math.min(lo0, -0.12 * span) - 0.04 * span;
  const top = hi + 0.06 * span;
  const X = (x: number) => m.l + (x / LE) * pw;
  const Y = (v: number) => m.t + ((top - v) / (top - lo)) * ph;

  const ticks = niceTicks(lo, top, 5);
  const tickStep = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const tickDp = Math.max(0, Math.ceil(-Math.log10(tickStep) + 1e-9) + (Math.abs((tickStep / 10 ** Math.floor(Math.log10(tickStep))) - 2.5) < 1e-6 ? 1 : 0));
  const threadTicks = rows.filter((r) => Math.abs(r.thread - Math.round(r.thread)) < 1e-6);
  const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

  // direct end labels, skipped when they would collide (legend + tooltip carry them)
  const last = rows[rows.length - 1];
  const endLabels = series
    .map((s) => ({ ...s, y: Y(last[s.key]), v: last[s.key] }))
    .sort((a, b) => a.y - b.y);
  const shown = endLabels.filter((l, i) => {
    const prev = endLabels[i - 1];
    const next = endLabels[i + 1];
    return (!prev || l.y - prev.y > 13) && (!next || next.y - l.y > 13);
  });

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * pw;
    const x = (px / pw) * LE;
    let best = 0;
    for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i].x - x) < Math.abs(rows[best].x - x)) best = i;
    setHover(best);
  };

  const hv = hover !== null ? rows[hover] : null;
  const surface = dark ? '#0f172a' : '#ffffff';
  const grid = dark ? '#334155' : '#e5e7eb';
  const axisInk = dark ? '#94a3b8' : '#64748b';

  return (
    <div ref={wrapRef} className="relative">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-slate-600 dark:text-slate-300">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden>
              <line x1="0" x2="16" y1="4" y2="4" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
            </svg>
            {s.name}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: CRITICAL, opacity: 0.18 }} />
          interference zone (gap &lt; 0)
        </li>
      </ul>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label="Axial flank gap along the engaged threads"
        className="block max-w-full"
      >
        {/* interference zone */}
        <rect x={m.l} y={Y(0)} width={pw} height={Y(lo) - Y(0)} fill={CRITICAL} opacity={0.1} />
        <text x={m.l + 6} y={Y(lo) - 6} fontSize={11} className="fill-slate-600 dark:fill-slate-300">
          ⚠ interference
        </text>
        {/* grid + y ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={m.l + pw} y1={Y(t)} y2={Y(t)} stroke={grid} strokeWidth={1} />
            <text
              x={m.l - 6}
              y={Y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize={11}
              fill={axisInk}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {t.toFixed(tickDp)}
            </text>
          </g>
        ))}
        <line x1={m.l} x2={m.l + pw} y1={Y(0)} y2={Y(0)} stroke={axisInk} strokeWidth={1} />
        {/* x ticks: thread number */}
        {threadTicks.map((r) => (
          <text
            key={r.thread}
            x={X(r.x)}
            y={m.t + ph + 16}
            textAnchor="middle"
            fontSize={11}
            fill={axisInk}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(r.thread)}
          </text>
        ))}
        <text x={m.l + pw / 2} y={H - 4} textAnchor="middle" fontSize={11} fill={axisInk}>
          engaged thread no. (1 = at the nut bearing face)
        </text>
        <text
          transform={`translate(11 ${m.t + ph / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={11}
          fill={axisInk}
        >
          axial gap [{unitLabel}]
        </text>
        {/* series */}
        {series.map((s) => (
          <g key={s.key}>
            <polyline
              points={rows.map((r) => `${X(r.x).toFixed(1)},${Y(r[s.key]).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={X(last.x)} cy={Y(last[s.key])} r={4} fill={s.color} stroke={surface} strokeWidth={2} />
          </g>
        ))}
        {shown.map((l) => (
          <text
            key={l.key}
            x={X(last.x) + 9}
            y={l.y}
            dy="0.32em"
            fontSize={11}
            className="fill-slate-700 dark:fill-slate-200"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fmt(l.v)} · {l.key === 'loaded' ? 'loaded' : l.key === 'backMMC' ? 'MMC' : 'LMC'}
          </text>
        ))}
        {/* crosshair */}
        {hv && (
          <g pointerEvents="none">
            <line x1={X(hv.x)} x2={X(hv.x)} y1={m.t} y2={m.t + ph} stroke={axisInk} strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.key} cx={X(hv.x)} cy={Y(hv[s.key])} r={4} fill={s.color} stroke={surface} strokeWidth={2} />
            ))}
          </g>
        )}
        <rect
          x={m.l}
          y={m.t}
          width={pw}
          height={ph}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hv && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: Math.min(X(hv.x) + 12, width - 190),
            top: 34,
          }}
        >
          <div className="text-slate-500 dark:text-slate-400 mb-1">
            thread {hv.thread.toFixed(hv.thread % 1 ? 1 : 0)} · {(hv.x * (unit === 'in' ? 1 : 25.4)).toFixed(3)}{' '}
            {unit} from first thread
          </div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <svg width="12" height="6" aria-hidden>
                <line x1="0" x2="12" y1="3" y2="3" stroke={s.color} strokeWidth="2" />
              </svg>
              <span className="font-semibold tabular-nums">{fmt(hv[s.key])}</span>
              <span className="text-slate-500 dark:text-slate-400">{s.name}</span>
            </div>
          ))}
        </div>
      )}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-slate-500 dark:text-slate-400">Data table</summary>
        <div className="overflow-x-auto mt-1">
          <table className="text-xs">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Thread</th>
                {series.map((s) => (
                  <th key={s.key} className="px-2 py-1 text-right font-medium">
                    {s.name} [{unitLabel}]
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {rows.map((r) => (
                <tr key={r.x} className="border-t border-slate-100 dark:border-slate-800/60">
                  <td className="px-2 py-0.5">{r.thread.toFixed(r.thread % 1 ? 1 : 0)}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-2 py-0.5 text-right">
                      {fmt(r[s.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= count) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step) out.push(Math.abs(v) < 1e-12 ? 0 : v);
  return out;
}
