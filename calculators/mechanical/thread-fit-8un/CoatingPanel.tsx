'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
  UM_PER_IN,
  coatIn,
  coatingActive,
  coatingChecks,
  fmtIn,
  type CoatRange,
  type CoatingSpec,
  type ThreadFit,
} from './b11';
import { Num, labelCls } from './StrengthPanel';
import { PALETTE } from './viewTypes';

export const MAX_COAT_UM = 250;

interface Props {
  /** Base-metal fit (after any nut oversize) */
  fit: ThreadFit;
  /** Same fit after coating */
  surf: ThreadFit;
  coat: CoatingSpec;
  setCoat: (fn: (prev: CoatingSpec) => CoatingSpec) => void;
  dark: boolean;
}

function Badge({ kind, children }: { kind: 'ok' | 'warn' | 'bad'; children: React.ReactNode }) {
  const cls =
    kind === 'ok'
      ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200'
      : kind === 'warn'
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
        : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200';
  const Icon = kind === 'ok' ? CheckCircle2 : kind === 'warn' ? AlertTriangle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon size={12} /> {children}
    </span>
  );
}

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CoatRange;
  onChange: (key: 'min' | 'max', v: number) => void;
}) {
  const [lo, hi] = coatIn(value);
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>
          min <Num ariaLabel={`${label} minimum thickness`} step="1" width="w-20" value={value.min} onChange={(v) => onChange('min', v)} suffix="µm" />
        </span>
        <span>
          max <Num ariaLabel={`${label} maximum thickness`} step="1" width="w-20" value={value.max} onChange={(v) => onChange('max', v)} suffix="µm" />
        </span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
        = {fmtIn(lo, 5)} … {fmtIn(hi, 5)} in · pitch Ø {lo === hi ? '' : `${fmtIn(4 * lo, 4)} … `}
        {fmtIn(4 * hi, 4)} in
      </div>
    </div>
  );
}

/**
 * Thread coating on bolt and nut (min / max thickness in µm). Limits of the
 * 2A / 2B threads apply before coating (ASME B1.1); the coating is used for
 * fit (clearance, interference) only — strength stays on base metal.
 */
export function CoatingPanel({ fit, surf, coat, setCoat, dark }: Props) {
  const active = coatingActive(coat);
  const chk = coatingChecks(fit, coat);
  const c = surf.clearance;
  const assemblyGap = c.pitch.min; // PD clearance at MMC/MMC after coating
  const crestRoot = Math.min(c.major.min, c.minor.min);
  const swatch = dark ? PALETTE.coating.dark : PALETTE.coating.light;
  const minMaxBad = coat.bolt.min > coat.bolt.max || coat.nut.min > coat.nut.max;

  const edit = (part: 'bolt' | 'nut') => (key: 'min' | 'max', v: number) =>
    setCoat((p) => ({
      ...p,
      [part]: { ...p[part], [key]: Number.isFinite(v) ? Math.min(Math.max(v, 0), MAX_COAT_UM) : p[part][key] },
    }));

  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <header className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold">
          Thread coating{' '}
          <span className="font-normal text-slate-500 dark:text-slate-400">
            — thickness normal to the thread surface; 2A / 2B limits apply before coating (ASME B1.1)
          </span>
        </h3>
      </header>
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none mt-5">
            <input
              type="checkbox"
              checked={coat.on}
              onChange={(e) => setCoat((p) => ({ ...p, on: e.target.checked }))}
              className="h-4 w-4 accent-accent-600"
            />
            Coat threads
            <span
              aria-hidden
              className="inline-block h-3 w-5 rounded-sm ring-1 ring-black/10"
              style={{ background: swatch }}
              title="Coating colour in the section views"
            />
          </label>
          <RangeInput label="Bolt thread coating" value={coat.bolt} onChange={edit('bolt')} />
          <RangeInput label="Nut thread coating" value={coat.nut} onChange={edit('nut')} />
        </div>

        {minMaxBad && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Minimum is above maximum — the two values are used in ascending order.
          </p>
        )}

        {active ? (
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <div>
              Pitch-diameter clearance used by the coating at MMC/MMC: 4·(t<sub>b,max</sub> + t<sub>n,max</sub>) ={' '}
              <span className="font-mono">
                {fmtIn(chk.pdConsumed, 4)} in ({(chk.pdConsumed * UM_PER_IN).toFixed(0)} µm)
              </span>{' '}
              of {fmtIn(fit.clearance.pitch.min, 4)} in available → remaining{' '}
              <span className="font-mono">{fmtIn(assemblyGap, 4)} in</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Assembly, MMC bolt in MMC nut (no load):</span>
              {assemblyGap >= 0 && crestRoot >= 0 ? (
                <Badge kind="ok">assembles — flank play {fmtIn(assemblyGap * Math.tan(Math.PI / 6), 5)} in axial</Badge>
              ) : (
                <Badge kind="bad">
                  interference — won&apos;t assemble ({assemblyGap < 0 ? `flanks ${fmtIn(-assemblyGap, 4)} in on pitch Ø` : ''}
                  {assemblyGap < 0 && crestRoot < 0 ? ', ' : ''}
                  {crestRoot < 0 ? `crest/root ${fmtIn(-crestRoot, 4)} in` : ''})
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Bolt 2A (B1.1: coating must fit within the allowance, 4·t ≤ es):</span>
              {chk.boltWithinBasic ? (
                <Badge kind="ok">within basic size (t ≤ {chk.boltMaxInAllowance.toFixed(1)} µm)</Badge>
              ) : (
                <Badge kind="warn">
                  coated bolt exceeds basic by {fmtIn(chk.boltOverBasic, 4)} in on pitch Ø (limit t ={' '}
                  {chk.boltMaxInAllowance.toFixed(1)} µm) — nut must be overtapped
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Nut 2B (no allowance):</span>
              {chk.nutBelowBasic ? (
                <Badge kind="warn">coated nut is below basic size — overtap the nut</Badge>
              ) : (
                <Badge kind="ok">nut thread uncoated</Badge>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No coating applied. Enable it to include coating thickness in clearance and interference.
          </p>
        )}

        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          On a 60° thread a uniform coating t changes the pitch diameter by 4t and the major / minor diameters by
          2t (bolt larger, nut smaller). Maximum material uses the maximum thickness, least material the minimum.
          Clearance, flank play, the flank-gap chart and the interference fills (also without load) use the coated
          surfaces; tension and stripping use base metal. The “Set to required” oversize includes the coating. In
          the sections the coating is the {dark ? 'light' : 'dark'}-grey band on each condition.
        </p>
      </div>
    </section>
  );
}
