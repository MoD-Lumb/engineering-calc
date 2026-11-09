'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Pause, Play, XCircle } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';
import { rowsToTSV } from '@/lib/format';
import { fmtIn, type ThreadFit } from './b11';
import type { Cond } from './geometry';
import {
  BOLT_GRADES,
  LBF_PER_KN,
  MPA_PER_KSI,
  NUT_GRADES,
  boltGradeProps,
  defaultGrip,
  type BoltLengths,
  type BoltProps,
  type StrengthResult,
} from './strength';

/* ------------------------------------------------------------------------ */
/* Load case state                                                           */
/* ------------------------------------------------------------------------ */

export type ForceUnit = 'kN' | 'lbf';

export interface LoadCase {
  boltGrade: string;
  boltCustom: { Sy: number; Su: number; E: number };
  nutGrade: string;
  nutCustom: { Sy: number; Su: number };
  /** Working load in `unit` */
  F: number;
  unit: ForceUnit;
  /** Grip length [in]; null = default 2D */
  grip: number | null;
  applied: boolean;
  /** Elongation magnification of the free length */
  M: number;
}

export const DEFAULT_LOAD_CASE: LoadCase = {
  boltGrade: 'B7',
  boltCustom: { Sy: 105, Su: 125, E: 29000 },
  nutGrade: '2H',
  nutCustom: { Sy: 95, Su: 120 },
  F: 200,
  unit: 'kN',
  grip: null,
  applied: false,
  M: 100,
};

export interface ResolvedBolt extends BoltProps {
  name: string;
  note: string;
  maxD: number | null;
}

export function resolveBolt(lc: LoadCase, D: number): ResolvedBolt {
  const g = BOLT_GRADES.find((b) => b.id === lc.boltGrade);
  if (!g) {
    return { ...lc.boltCustom, nu: 0.3, covered: true, name: 'Custom', note: 'User-defined material', maxD: null };
  }
  return { ...boltGradeProps(g, D), name: g.name, note: g.note, maxD: g.bands[g.bands.length - 1].maxD };
}

export function resolveNut(lc: LoadCase) {
  const g = NUT_GRADES.find((n) => n.id === lc.nutGrade);
  if (!g) return { ...lc.nutCustom, name: 'Custom', note: 'User-defined material' };
  return { Su: g.Su, Sy: g.Sy, name: g.name, note: g.note };
}

export function forceLbf(lc: LoadCase): number {
  return lc.unit === 'kN' ? lc.F * LBF_PER_KN : lc.F;
}

export function effectiveGrip(lc: LoadCase, D: number): number {
  return lc.grip ?? defaultGrip(D);
}

/* ------------------------------------------------------------------------ */
/* Formatting                                                                */
/* ------------------------------------------------------------------------ */

export type Sys = 'imp' | 'si';
export interface Q {
  imp: string;
  si: string;
}
export const q = {
  force: (lbf: number): Q => ({ imp: `${(lbf / 1000).toFixed(1)} kip`, si: `${(lbf / LBF_PER_KN).toFixed(1)} kN` }),
  stress: (psi: number): Q => ({
    imp: `${(psi / 1000).toFixed(1)} ksi`,
    si: `${((psi / 1000) * MPA_PER_KSI).toFixed(0)} MPa`,
  }),
  ksi: (ksi: number): Q => ({ imp: `${ksi.toFixed(0)} ksi`, si: `${(ksi * MPA_PER_KSI).toFixed(0)} MPa` }),
  area: (in2: number): Q => ({ imp: `${in2.toFixed(4)} in²`, si: `${(in2 * 645.16).toFixed(1)} mm²` }),
  len: (inch: number): Q => ({ imp: `${inch.toFixed(4)} in`, si: `${(inch * 25.4).toFixed(3)} mm` }),
  small: (inch: number): Q => ({ imp: `${inch.toFixed(5)} in`, si: `${(inch * 25.4 * 1000).toFixed(1)} µm` }),
  pct: (x: number): Q => ({ imp: `${(x * 100).toFixed(0)} %`, si: `${(x * 100).toFixed(0)} %` }),
  text: (t: string): Q => ({ imp: t, si: t }),
};

export function Val({ v, sys }: { v: Q; sys: Sys }) {
  const [a, b] = sys === 'si' ? [v.si, v.imp] : [v.imp, v.si];
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="font-mono tabular-nums">{a}</span>
      {b !== a && <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">{b}</span>}
    </span>
  );
}

export function StatusBadge({ util, labels }: { util: number; labels?: [string, string, string] }) {
  const [ok, near, bad] = labels ?? ['OK', 'near limit', 'exceeds'];
  if (!Number.isFinite(util)) return null;
  if (util > 1)
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200">
        <XCircle size={12} /> {bad}
      </span>
    );
  if (util > 0.9)
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
        <AlertTriangle size={12} /> {near}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200">
      <CheckCircle2 size={12} /> {ok}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Inputs                                                                    */
/* ------------------------------------------------------------------------ */

export const inputCls =
  'rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-accent-500';
export const labelCls = 'block text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';

export function Num({
  value,
  onChange,
  width = 'w-20',
  step = 'any',
  suffix,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  width?: string;
  step?: string;
  suffix?: string;
  ariaLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        aria-label={ariaLabel}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        className={`${inputCls} ${width}`}
      />
      {suffix && <span className="text-xs text-slate-500 dark:text-slate-400">{suffix}</span>}
    </span>
  );
}

interface InputsProps {
  fit: ThreadFit;
  lc: LoadCase;
  setLc: (fn: (prev: LoadCase) => LoadCase) => void;
  res: StrengthResult;
  lens: BoltLengths;
  /** Visible pair used for the 3D interference picture */
  pair: { bolt: Cond; nut: Cond; gapEnd: number };
}

export function LoadCaseInputs({ fit, lc, setLc, res, lens, pair }: InputsProps) {
  const D = fit.D;
  const bolt = resolveBolt(lc, D);
  const nut = resolveNut(lc);

  const editBolt = (key: 'Sy' | 'Su' | 'E', v: number) =>
    setLc((p) => {
      const cur = resolveBolt(p, D);
      return { ...p, boltGrade: 'custom', boltCustom: { Sy: cur.Sy, Su: cur.Su, E: cur.E, [key]: v } };
    });
  const editNut = (key: 'Sy' | 'Su', v: number) =>
    setLc((p) => {
      const cur = resolveNut(p);
      return { ...p, nutGrade: 'custom', nutCustom: { Sy: cur.Sy, Su: cur.Su, [key]: v } };
    });
  const setUnit = (u: ForceUnit) =>
    setLc((p) => {
      if (p.unit === u) return p;
      const lbf = forceLbf(p);
      const F = u === 'kN' ? lbf / LBF_PER_KN : lbf;
      return { ...p, unit: u, F: Math.round(F * 10) / 10 };
    });
  const setFraction = (frac: number) =>
    setLc((p) => {
      const lbf = res.Fy * frac;
      const F = p.unit === 'kN' ? lbf / LBF_PER_KN : lbf;
      return { ...p, F: p.unit === 'kN' ? Math.round(F) : Math.round(F / 100) * 100 };
    });
  const grip = effectiveGrip(lc, D);

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <header className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold">
          Load case{' '}
          <span className="font-normal text-slate-500 dark:text-slate-400">
            — static tensile working load, nut fixed, load pulls the bolt head
          </span>
        </h3>
      </header>
      <div className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="ec-bolt-mat">
              Bolt material
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="ec-bolt-mat"
                value={lc.boltGrade}
                onChange={(e) => {
                  const id = e.target.value;
                  const g = BOLT_GRADES.find((b) => b.id === id);
                  setLc((p) => ({ ...p, boltGrade: id, nutGrade: g ? g.nut : p.nutGrade }));
                }}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
              >
                {BOLT_GRADES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
              <span>
                S<sub>y</sub> <Num ariaLabel="Bolt yield strength" value={bolt.Sy} onChange={(v) => editBolt('Sy', v)} suffix="ksi" />
              </span>
              <span>
                S<sub>u</sub> <Num ariaLabel="Bolt tensile strength" value={bolt.Su} onChange={(v) => editBolt('Su', v)} suffix="ksi" />
              </span>
              <span>
                E <Num ariaLabel="Young's modulus" width="w-24" value={bolt.E} onChange={(v) => editBolt('E', v)} suffix="ksi" />
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {bolt.note}
              {bolt.name !== 'Custom' && ` · minimum values for D = ${fmtIn(D, 3)} in`}
            </p>
            {!bolt.covered && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle size={12} /> {bolt.name} covers diameters up to {bolt.maxD} in only — values of the
                largest band shown; enter certified values.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="ec-nut-mat">
              Nut material
            </label>
            <select
              id="ec-nut-mat"
              value={lc.nutGrade}
              onChange={(e) => setLc((p) => ({ ...p, nutGrade: e.target.value }))}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
            >
              {NUT_GRADES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
              <span>
                S<sub>y</sub> <Num ariaLabel="Nut yield strength" value={nut.Sy} onChange={(v) => editNut('Sy', v)} suffix="ksi" />
              </span>
              <span>
                S<sub>u</sub> <Num ariaLabel="Nut tensile strength" value={nut.Su} onChange={(v) => editNut('Su', v)} suffix="ksi" />
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{nut.note}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <span className={labelCls}>Working load F</span>
            <div className="flex items-center gap-2">
              <Num
                ariaLabel="Working load"
                width="w-28"
                value={lc.F}
                onChange={(v) => setLc((p) => ({ ...p, F: v }))}
              />
              <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5" role="radiogroup" aria-label="Force unit">
                {(['kN', 'lbf'] as ForceUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={lc.unit === u}
                    onClick={() => setUnit(u)}
                    className={
                      'px-2 py-0.5 text-xs font-medium rounded ' +
                      (lc.unit === u
                        ? 'bg-accent-600 text-white dark:bg-accent-500'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
                    }
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              = {(res.F / LBF_PER_KN).toFixed(1)} kN = {(res.F / 1000).toFixed(2)} kip ={' '}
              {(res.utilTension * 100).toFixed(0)} % of F<sub>y</sub>
              <span className="ml-1">set:</span>
              {[0.5, 0.75, 0.9].map((fr) => (
                <button
                  key={fr}
                  type="button"
                  onClick={() => setFraction(fr)}
                  className="rounded border border-slate-200 dark:border-slate-700 px-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {fr * 100}% F<sub>y</sub>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={labelCls}>Grip length (head to nut face)</span>
            <div className="flex items-center gap-2">
              <Num
                ariaLabel="Grip length"
                step="0.125"
                value={grip}
                onChange={(v) => setLc((p) => ({ ...p, grip: Number.isFinite(v) ? Math.min(Math.max(v, 0.25), 12 * D) : p.grip }))}
                suffix="in"
              />
              {lc.grip !== null && (
                <button
                  type="button"
                  className="text-[11px] text-accent-700 dark:text-accent-400 hover:underline"
                  onClick={() => setLc((p) => ({ ...p, grip: null }))}
                >
                  reset to 2D
                </button>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {(grip * 25.4).toFixed(1)} mm · bolt length {fmtIn(lens.L, 2)} in, thread length {fmtIn(lens.LT, 2)} in
              (B18.2.1)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setLc((p) => ({ ...p, applied: !p.applied }))}
            className={
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ' +
              (lc.applied
                ? 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900'
                : 'bg-accent-600 text-white hover:bg-accent-700 dark:bg-accent-500')
            }
          >
            {lc.applied ? <Pause size={13} /> : <Play size={13} />}
            {lc.applied ? 'Remove load' : 'Apply load in 3D'}
          </button>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Elongation shown</span>
            <select
              value={lc.M}
              onChange={(e) => setLc((p) => ({ ...p, M: Number(e.target.value) }))}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-xs font-mono"
            >
              {[1, 10, 50, 100, 200, 500].map((m) => (
                <option key={m} value={m}>
                  ×{m}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            bolt σ/S<sub>y</sub> <StatusBadge util={res.utilTension} />
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            3D pair {pair.bolt}/{pair.nut}:{' '}
            {pair.gapEnd < 0 ? (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                <XCircle size={12} /> interference {fmtIn(-pair.gapEnd, 5)} in
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                <CheckCircle2 size={12} /> no interference (gap {fmtIn(pair.gapEnd, 5)} in)
              </span>
            )}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          In 3D the free length between head and nut is stretched ×{lc.M} so the elongation is visible. Inside the
          nut, the thread offsets use the tolerance magnification, so drawn interference and clearance are
          comparable. The magenta fill marks interference on the section.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Results                                                                   */
/* ------------------------------------------------------------------------ */

interface ResRow {
  label: ReactNode;
  tsvLabel: string;
  formula: string;
  /** single value or per pair */
  value?: Q;
  pair?: Record<Cond, Q>;
  badge?: ReactNode | Record<Cond, ReactNode>;
}

export function StrengthResults({
  fit,
  res,
  lens,
  lc,
}: {
  fit: ThreadFit;
  res: StrengthResult;
  lens: BoltLengths;
  lc: LoadCase;
}) {
  const sys: Sys = lc.unit === 'kN' ? 'si' : 'imp';
  const bolt = resolveBolt(lc, fit.D);
  const nut = resolveNut(lc);
  const n = fit.tpi;
  const per = (fn: (c: Cond) => Q): Record<Cond, Q> => ({ MMC: fn('MMC'), LMC: fn('LMC') });
  const minStripY = (c: Cond) => Math.min(res.strip[c].FyBolt, res.strip[c].FyNut);
  const minStripU = (c: Cond) => Math.min(res.strip[c].FuBolt, res.strip[c].FuNut);

  const sections: Array<{ title: string; note?: string; rows: ResRow[] }> = [
    {
      title: 'Bolt tension',
      rows: [
        {
          label: 'Tensile stress area Aₛ',
          tsvLabel: 'Tensile stress area As',
          formula: res.highStrength ? `π(Es,min/2 − 0.16238/n)²  (Su > 100 ksi)` : `0.7854(D − 0.9743/n)²`,
          value: q.area(res.As),
        },
        { label: 'Tensile stress σ', tsvLabel: 'Tensile stress', formula: 'F / As', value: q.stress(res.sigma) },
        { label: `Yield strength Sᵧ (${bolt.name})`, tsvLabel: 'Yield strength Sy', formula: 'material spec, min.', value: q.ksi(bolt.Sy) },
        { label: 'Yield load Fᵧ', tsvLabel: 'Yield load Fy', formula: 'Sy · As', value: q.force(res.Fy) },
        {
          label: 'Utilisation / safety factor',
          tsvLabel: 'Utilisation sigma/Sy',
          formula: 'σ / Sy  ·  Sy / σ',
          value: q.text(
            `${(res.utilTension * 100).toFixed(0)} % · ${res.utilTension > 0 ? (1 / res.utilTension).toFixed(2) : '∞'}`
          ),
          badge: <StatusBadge util={res.utilTension} />,
        },
        { label: 'Breaking load Fᵤ', tsvLabel: 'Breaking load Fu', formula: 'Su · As', value: q.force(res.Fu) },
      ],
    },
    {
      title: `Thread stripping (LE = ${fmtIn(lens.LE)} in = nut thickness − countersinks)`,
      rows: [
        {
          label: 'Shear area, bolt thread A_sb',
          tsvLabel: 'Shear area bolt thread',
          formula: `π n LE D₁ [1/(2n) + 0.57735 (d₂ − D₁)]`,
          pair: per((c) => q.area(res.strip[c].ABolt)),
        },
        {
          label: 'Shear area, nut thread A_sn',
          tsvLabel: 'Shear area nut thread',
          formula: `π n LE d [1/(2n) + 0.57735 (d − D₂)]`,
          pair: per((c) => q.area(res.strip[c].ANut)),
        },
        {
          label: 'Stripping stress, bolt thread τ_b',
          tsvLabel: 'Stripping stress bolt thread',
          formula: `F / A_sb  vs 0.577·Sy,bolt = ${(0.577 * bolt.Sy).toFixed(1)} ksi`,
          pair: per((c) => q.stress(res.strip[c].tauBolt)),
          badge: { MMC: <StatusBadge util={res.strip.MMC.utilBolt} />, LMC: <StatusBadge util={res.strip.LMC.utilBolt} /> },
        },
        {
          label: 'Stripping stress, nut thread τ_n',
          tsvLabel: 'Stripping stress nut thread',
          formula: `F / A_sn  vs 0.577·Sy,nut = ${(0.577 * nut.Sy).toFixed(1)} ksi`,
          pair: per((c) => q.stress(res.strip[c].tauNut)),
          badge: { MMC: <StatusBadge util={res.strip.MMC.utilNut} />, LMC: <StatusBadge util={res.strip.LMC.utilNut} /> },
        },
        {
          label: 'Utilisation (governing thread)',
          tsvLabel: 'Stripping utilisation',
          formula: 'max(τ_b/0.577Sy,b ; τ_n/0.577Sy,n)',
          pair: per((c) => q.pct(Math.max(res.strip[c].utilBolt, res.strip[c].utilNut))),
        },
        {
          label: 'Stripping load at shear yield',
          tsvLabel: 'Stripping load at shear yield',
          formula: 'min(0.577 Sy·A) of bolt / nut thread',
          pair: per((c) => q.force(minStripY(c))),
        },
        {
          label: 'Ultimate stripping load',
          tsvLabel: 'Ultimate stripping load',
          formula: `min(0.6 Su·A)  vs bolt break ${(res.Fu / 1000).toFixed(1)} kip`,
          pair: per((c) => q.force(minStripU(c))),
          badge: {
            MMC: <StatusBadge util={res.Fu / minStripU('MMC')} labels={['bolt breaks first', 'marginal', 'thread strips first']} />,
            LMC: <StatusBadge util={res.Fu / minStripU('LMC')} labels={['bolt breaks first', 'marginal', 'thread strips first']} />,
          },
        },
        {
          label: 'Required engagement (B1.1 App. B)',
          tsvLabel: 'Required engagement length',
          formula: `2·As/(π n Kn,max[…]) at LMC, vs LE = ${fmtIn(lens.LE)} in`,
          value: q.len(res.LEreq),
          badge: <StatusBadge util={res.LEreq / lens.LE} labels={['LE sufficient', 'marginal', 'LE too short']} />,
        },
      ],
    },
    {
      title: 'Elongation, nut fixed',
      note: `E = ${bolt.E.toLocaleString('en-US')} ksi · grip ${fmtIn(lens.grip, 3)} in`,
      rows: [
        {
          label: `Plain shank (Ls = ${fmtIn(lens.Ls, 3)} in)`,
          tsvLabel: 'Elongation plain shank',
          formula: 'F·Ls / (E·Ab)',
          value: q.small(res.dShank),
        },
        {
          label: `Free thread (Lt = ${fmtIn(lens.Lt, 3)} in)`,
          tsvLabel: 'Elongation free thread',
          formula: 'F·Lt / (E·As)',
          value: q.small(res.dThread),
        },
        {
          label: `Engaged thread (LE = ${fmtIn(lens.LE, 3)} in)`,
          tsvLabel: 'Elongation engaged thread (pitch growth)',
          formula: 'F·LE / (E·As)  (full-load stretch)',
          value: q.small(res.dEngaged),
        },
        { label: 'Total bolt elongation δ', tsvLabel: 'Total elongation', formula: 'sum', value: q.small(res.dTotal) },
      ],
    },
    {
      title: 'Flank fit under load (full-load stretch, first engaged thread bears)',
      rows: [
        {
          label: 'Axial flank play a',
          tsvLabel: 'Axial flank play',
          formula: '(D₂ − d₂) · tan 30°',
          pair: per((c) => q.small(res.fit[c].a)),
        },
        {
          label: 'Gain from Poisson contraction p',
          tsvLabel: 'Poisson gain',
          formula: 'ν·ε·d₂·tan 30°',
          pair: per((c) => q.small(res.fit[c].p)),
        },
        {
          label: 'Pitch growth over LE',
          tsvLabel: 'Pitch growth',
          formula: `ε·LE, ε = F/(E·As) = ${(res.epsT * 1e6).toFixed(0)} µε`,
          pair: per((c) => q.small(res.fit[c].growth)),
        },
        {
          label: 'Back-flank gap, last engaged thread',
          tsvLabel: 'Back-flank gap at last thread',
          formula: 'a + p − ε·LE   (< 0 = interference)',
          pair: per((c) => q.small(res.fit[c].gapEnd)),
          badge: {
            MMC: <StatusBadge util={res.fit.MMC.gapEnd < 0 ? 2 : 0} labels={['no interference', '', 'interference']} />,
            LMC: <StatusBadge util={res.fit.LMC.gapEnd < 0 ? 2 : 0} labels={['no interference', '', 'interference']} />,
          },
        },
        {
          label: 'Interference starts at load',
          tsvLabel: 'Interference onset load',
          formula: 'a·E·As / (LE − ν·d₂·tan 30°)',
          pair: per((c) => (Number.isFinite(res.fit[c].Fint) ? q.force(res.fit[c].Fint) : q.text('never'))),
        },
      ],
    },
  ];

  const tsv = rowsToTSV([
    ['Section', 'Quantity', 'Formula', 'MMC/MMC (imperial)', 'LMC/LMC (imperial)', 'MMC/MMC (SI)', 'LMC/LMC (SI)'],
    ...sections.flatMap((s) =>
      s.rows.map((r) => {
        const a = r.pair?.MMC ?? r.value!;
        const b = r.pair?.LMC ?? r.value!;
        return [s.title, r.tsvLabel, r.formula, a.imp, b.imp, a.si, b.si];
      })
    ),
  ]);

  const badgeFor = (r: ResRow, c: Cond) =>
    r.badge && typeof r.badge === 'object' && 'MMC' in (r.badge as Record<string, unknown>)
      ? (r.badge as Record<Cond, ReactNode>)[c]
      : null;

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold">
          Strength at working load F = {(res.F / LBF_PER_KN).toFixed(1)} kN ({(res.F / 1000).toFixed(2)} kip)
        </h3>
        <CopyButton label="Copy table" text={tsv} />
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Quantity</th>
              <th className="px-3 py-2 text-left font-medium">Formula</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">MMC / MMC</th>
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap">LMC / LMC</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <SectionRows key={s.title} title={s.title} note={s.note}>
                {s.rows.map((r) => (
                  <tr key={r.tsvLabel} className="border-t border-slate-100 dark:border-slate-800/60 align-top">
                    <td className="px-3 py-1.5">{r.label}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{r.formula}</td>
                    {r.pair ? (
                      (['MMC', 'LMC'] as Cond[]).map((c) => (
                        <td key={c} className="px-3 py-1.5 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Val v={r.pair![c]} sys={sys} />
                            {badgeFor(r, c)}
                          </div>
                        </td>
                      ))
                    ) : (
                      <td colSpan={2} className="px-3 py-1.5 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Val v={r.value!} sys={sys} />
                          {r.badge && !badgeFor(r, 'MMC') ? (r.badge as ReactNode) : null}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </SectionRows>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 leading-relaxed">
        Static load, no preload, rigid nut, uniform shear over the engaged threads (B1.1 / FED-STD-H28 shear areas),
        shear yield 0.577·S<sub>y</sub> (von Mises), ultimate shear 0.6·S<sub>u</sub>. n = {n} tpi. Nut strengths of the
        presets are estimates. The flank fit is a kinematic check: real threads bend and share load, so
        &quot;interference&quot; marks where the first/last threads must deform rather than a jammed assembly.
      </p>
    </section>
  );
}

function SectionRows({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <>
      <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30">
        <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold">
          {title}
          {note && <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">{note}</span>}
        </td>
      </tr>
      {children}
    </>
  );
}
