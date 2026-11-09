'use client';

import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { rowsToTSV } from '@/lib/format';
import { applyNutOversize, fmtIn, type ThreadFit } from './b11';
import {
  computeStrength,
  maxOversize,
  requiredOversize,
  type BoltLengths,
  type BoltProps,
} from './strength';
import { Num, StatusBadge, Val, labelCls, q, type Q, type Sys } from './StrengthPanel';

export interface OversizeState {
  on: boolean;
  /** Diametral oversize of the whole nut thread form [in] */
  delta: number;
}

export const DEFAULT_OVERSIZE: OversizeState = { on: false, delta: 0.003 };
export const MAX_OVERSIZE_INPUT = 0.1;

interface Props {
  /** Standard (not oversized) fit */
  fitBase: ThreadFit;
  lens: BoltLengths;
  /** Working load [lbf] */
  F: number;
  bolt: BoltProps;
  nut: { Sy: number; Su: number };
  os: OversizeState;
  setOs: (fn: (prev: OversizeState) => OversizeState) => void;
  sys: Sys;
}

interface Row {
  label: string;
  pair: string;
  std: Q;
  ovs: Q;
  change: string;
  badges?: [ReactNode, ReactNode];
}

const pct = (a: number, b: number) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) < 1e-12) return '—';
  const v = ((b - a) / Math.abs(a)) * 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)} %`;
};
const diff = (a: number, b: number, dp = 5) => `${b - a >= 0 ? '+' : ''}${(b - a).toFixed(dp)} in`;
const interferenceBadge = (gap: number) => (
  <StatusBadge util={gap < 0 ? 2 : 0} labels={['no interference', '', 'interference']} />
);

/**
 * Nut tapped oversize (whole thread form): input, minimum required oversize at
 * the working load, maximum oversize keeping "bolt breaks first", and a
 * before / after comparison with the standard 2B nut.
 */
export function OversizePanel({ fitBase, lens, F, bolt, nut, os, setOs, sys }: Props) {
  const delta = Number.isFinite(os.delta) ? Math.min(Math.max(os.delta, 0), MAX_OVERSIZE_INPUT) : 0;

  const { std, ovs, req, max, fitOs } = useMemo(() => {
    const std = computeStrength(fitBase, lens, F, bolt, nut);
    const fitOs = applyNutOversize(fitBase, delta);
    const ovs = computeStrength(fitOs, lens, F, bolt, nut);
    const req = requiredOversize(fitBase, F, std.As, bolt.E, bolt.nu, lens.LE);
    const max = maxOversize(fitBase, lens, F, bolt, nut);
    return { std, ovs, req, max, fitOs };
  }, [fitBase, lens, F, bolt, nut, delta]);

  const engPct = (e: number) => `${((e / fitBase.basicEngagement) * 100).toFixed(0)} % of basic`;
  const gov = (r: typeof std) => Math.max(r.strip.LMC.utilBolt, r.strip.LMC.utilNut);
  const fuStrip = (r: typeof std) => Math.min(r.strip.LMC.FuBolt, r.strip.LMC.FuNut);
  const txt = (t: string): Q => ({ imp: t, si: t });

  const rows: Row[] = [
    {
      label: 'Nut pitch diameter D₂ min / max',
      pair: '',
      std: txt(`${fmtIn(fitBase.int.pitchMin)} / ${fmtIn(fitBase.int.pitchMax)} in`),
      ovs: txt(`${fmtIn(fitOs.int.pitchMin)} / ${fmtIn(fitOs.int.pitchMax)} in`),
      change: `+${fmtIn(delta)} in`,
    },
    {
      label: 'Nut minor diameter D₁ min / max',
      pair: '',
      std: txt(`${fmtIn(fitBase.int.minorMin)} / ${fmtIn(fitBase.int.minorMax)} in`),
      ovs: txt(`${fmtIn(fitOs.int.minorMin)} / ${fmtIn(fitOs.int.minorMax)} in`),
      change: `+${fmtIn(delta)} in`,
    },
    {
      label: 'Axial flank play a',
      pair: 'MMC/MMC',
      std: q.small(std.fit.MMC.a),
      ovs: q.small(ovs.fit.MMC.a),
      change: diff(std.fit.MMC.a, ovs.fit.MMC.a),
    },
    {
      label: 'Back-flank gap, last engaged thread',
      pair: 'MMC/MMC',
      std: q.small(std.fit.MMC.gapEnd),
      ovs: q.small(ovs.fit.MMC.gapEnd),
      change: diff(std.fit.MMC.gapEnd, ovs.fit.MMC.gapEnd),
      badges: [interferenceBadge(std.fit.MMC.gapEnd), interferenceBadge(ovs.fit.MMC.gapEnd)],
    },
    {
      label: 'Interference starts at load',
      pair: 'MMC/MMC',
      std: q.force(std.fit.MMC.Fint),
      ovs: q.force(ovs.fit.MMC.Fint),
      change: pct(std.fit.MMC.Fint, ovs.fit.MMC.Fint),
    },
    {
      label: 'Radial thread engagement',
      pair: 'LMC/LMC',
      std: { ...q.len(fitBase.clearance.engagement.min), si: `${q.len(fitBase.clearance.engagement.min).si} · ${engPct(fitBase.clearance.engagement.min)}` },
      ovs: { ...q.len(fitOs.clearance.engagement.min), si: `${q.len(fitOs.clearance.engagement.min).si} · ${engPct(fitOs.clearance.engagement.min)}` },
      change: pct(fitBase.clearance.engagement.min, fitOs.clearance.engagement.min),
    },
    {
      label: 'Shear area, nut thread A_sn',
      pair: 'LMC/LMC',
      std: q.area(std.strip.LMC.ANut),
      ovs: q.area(ovs.strip.LMC.ANut),
      change: pct(std.strip.LMC.ANut, ovs.strip.LMC.ANut),
    },
    {
      label: 'Shear area, bolt thread A_sb',
      pair: 'LMC/LMC',
      std: q.area(std.strip.LMC.ABolt),
      ovs: q.area(ovs.strip.LMC.ABolt),
      change: pct(std.strip.LMC.ABolt, ovs.strip.LMC.ABolt),
    },
    {
      label: 'Stripping utilisation (governing)',
      pair: 'LMC/LMC',
      std: q.pct(gov(std)),
      ovs: q.pct(gov(ovs)),
      change: pct(gov(std), gov(ovs)),
      badges: [<StatusBadge key="s" util={gov(std)} />, <StatusBadge key="o" util={gov(ovs)} />],
    },
    {
      label: `Ultimate stripping load (bolt breaks at ${(std.Fu / 1000).toFixed(1)} kip)`,
      pair: 'LMC/LMC',
      std: q.force(fuStrip(std)),
      ovs: q.force(fuStrip(ovs)),
      change: pct(fuStrip(std), fuStrip(ovs)),
      badges: [
        <StatusBadge key="s" util={std.Fu / fuStrip(std)} labels={['bolt breaks first', 'marginal', 'thread strips first']} />,
        <StatusBadge key="o" util={ovs.Fu / fuStrip(ovs)} labels={['bolt breaks first', 'marginal', 'thread strips first']} />,
      ],
    },
    {
      label: `Required engagement (available LE = ${fmtIn(lens.LE)} in)`,
      pair: 'LMC/LMC',
      std: q.len(std.LEreq),
      ovs: q.len(ovs.LEreq),
      change: pct(std.LEreq, ovs.LEreq),
      badges: [
        <StatusBadge key="s" util={std.LEreq / lens.LE} labels={['LE sufficient', 'marginal', 'LE too short']} />,
        <StatusBadge key="o" util={ovs.LEreq / lens.LE} labels={['LE sufficient', 'marginal', 'LE too short']} />,
      ],
    },
  ];

  const ovsHead = `Oversize +${fmtIn(delta)} in${os.on ? '' : ' (preview)'}`;
  const tsv = rowsToTSV([
    ['Quantity', 'Pair', 'Standard 2B (imperial)', `${ovsHead} (imperial)`, 'Standard 2B (SI)', `${ovsHead} (SI)`, 'Change'],
    ...rows.map((r) => [r.label, r.pair, r.std.imp, r.ovs.imp, r.std.si, r.ovs.si, r.change]),
  ]);

  const rangeOk = req.rounded <= max;
  const needed = req.exact > 0;

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold">
          Nut oversize (overtapping){' '}
          <span className="font-normal text-slate-500 dark:text-slate-400">
            — whole thread form: D₁, D₂ and D of the nut enlarged by Δ
          </span>
        </h3>
        <CopyButton label="Copy table" text={tsv} />
      </header>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={os.on}
              onChange={(e) => setOs((p) => ({ ...p, on: e.target.checked }))}
              className="h-4 w-4 accent-accent-600"
            />
            Oversize nut thread
          </label>
          <div>
            <span className={labelCls}>Oversize Δ (diametral)</span>
            <div className="flex items-center gap-2">
              <Num
                ariaLabel="Nut oversize"
                step="0.001"
                width="w-24"
                value={os.delta}
                onChange={(v) =>
                  setOs((p) => ({ ...p, delta: Number.isFinite(v) ? Math.min(Math.max(v, 0), MAX_OVERSIZE_INPUT) : p.delta }))
                }
                suffix="in"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">= {(delta * 25.4).toFixed(3)} mm</span>
            </div>
          </div>
          <button
            type="button"
            disabled={!needed}
            onClick={() => setOs(() => ({ on: true, delta: req.rounded }))}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold bg-accent-600 text-white hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-accent-500"
          >
            <Wand2 size={13} />
            {needed ? `Set to required +${fmtIn(req.rounded, 3)} in` : 'No oversize needed at this load'}
          </button>
        </div>

        <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 space-y-1">
          <div>
            Minimum to remove interference (MMC bolt in MMC nut at the working load):{' '}
            <span className="font-mono">
              Δ<sub>req</sub> = 1.732 · {fmtIn(Math.max(0, -std.fit.MMC.gapEnd), 5)} = {fmtIn(req.exact, 5)} in
            </span>{' '}
            → {fmtIn(req.rounded, 3)} in
          </div>
          <div>
            Maximum keeping “bolt breaks before the threads strip” (B1.1 App. B, LMC/LMC):{' '}
            <span className="font-mono">
              Δ<sub>max</sub> = {max >= MAX_OVERSIZE_INPUT ? `≥ ${fmtIn(MAX_OVERSIZE_INPUT, 3)}` : fmtIn(max, 4)} in
            </span>
          </div>
          <div>
            {rangeOk ? (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                <CheckCircle2 size={12} /> acceptable range {fmtIn(req.rounded, 3)} … {fmtIn(max, 4)} in
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <AlertTriangle size={12} /> oversize alone cannot satisfy both — increase the engagement length (thicker
                nut) or lower the load
              </span>
            )}
            {os.on && delta > max && (
              <span className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                <AlertTriangle size={12} /> Δ above Δ<sub>max</sub>: threads may strip before the bolt breaks
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-100 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-900/30">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Quantity</th>
                <th className="px-3 py-2 text-left font-medium">Pair</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Standard 2B</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap normal-case">{ovsHead}</th>
                <th className="px-3 py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-slate-100 dark:border-slate-800/60 align-top">
                  <td className="px-3 py-1.5">{r.label}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.pair}</td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <Val v={r.std} sys={sys} />
                      {r.badges?.[0]}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <Val v={r.ovs} sys={sys} />
                      {r.badges?.[1]}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {r.change}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Enlarging the whole internal thread form adds Δ·tan 30° of axial flank play, which absorbs the pitch growth
          of the stretched bolt. It also costs Δ/2 of thread engagement and some stripping area. An oversize nut no
          longer gauges as class 2B, so specify it as a special, e.g. “2B oversize +{fmtIn(delta, 3)} in”. Overtapping is
          standard practice for hot-dip galvanized nuts (ASTM A563 / A194). When enabled, the 3D model, profile detail,
          chart and all tables use the oversized nut.
        </p>
      </div>
    </section>
  );
}
