'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Crosshair, Maximize2, Move3d, RectangleHorizontal } from 'lucide-react';
import { SIZES_8UN, computeFit, fmtIn } from './b11';
import { visualDims, type Cond } from './geometry';
import { ProfileDetail } from './ProfileDetail';
import { ToleranceTables } from './ToleranceTables';
import { FlankGapChart } from './FlankGapChart';
import {
  DEFAULT_LOAD_CASE,
  LoadCaseInputs,
  StrengthResults,
  effectiveGrip,
  forceLbf,
  resolveBolt,
  resolveNut,
  type LoadCase,
} from './StrengthPanel';
import { boltLengths, computeStrength, flankFit, stretchParams } from './strength';
import {
  DEFAULT_VIS,
  PALETTE,
  type CondKey,
  type Config,
  type Section,
  type ViewKind,
  type Visibility,
} from './viewTypes';

const ThreadViewer = dynamic(() => import('./ThreadViewer'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Loading 3D view…</div>
  ),
});

const STORAGE_KEY = 'ec-inputs-thread-fit-8un';

function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains('dark'));
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={
              'px-2.5 py-1 text-xs font-medium rounded transition-colors ' +
              (value === o.value
                ? 'bg-accent-600 text-white dark:bg-accent-500'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolButton({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  color,
  label,
  sub,
  dashed,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
  label: string;
  sub?: string;
  dashed?: boolean;
}) {
  return (
    <label
      className={
        'flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer select-none transition-colors ' +
        (checked
          ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
          : 'border-slate-200 dark:border-slate-800 opacity-60')
      }
    >
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="h-3.5 w-3.5 rounded-sm ring-1 ring-black/15 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500 shrink-0"
        style={
          dashed
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` }
            : { background: checked ? color : 'transparent', boxShadow: `inset 0 0 0 2px ${color}` }
        }
      />
      <span className="text-xs leading-tight">
        <span className="font-medium">{label}</span>
        {sub && <span className="block text-[10px] text-slate-500 dark:text-slate-400">{sub}</span>}
      </span>
    </label>
  );
}

export default function ThreadFitCalculator() {
  const [sizeD, setSizeD] = useState(1.125);
  const [k, setK] = useState(2);
  const [config, setConfig] = useState<Config>('assembled');
  const [section, setSection] = useState<Section>('half');
  const [vis, setVis] = useState<Visibility>(DEFAULT_VIS);
  const [view, setView] = useState<{ kind: ViewKind; n: number }>({ kind: 'iso', n: 0 });
  const [lc, setLc] = useState<LoadCase>(DEFAULT_LOAD_CASE);
  const [hydrated, setHydrated] = useState(false);
  const dark = useDarkMode();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { D?: number; k?: number; lc?: Partial<LoadCase> };
        if (saved.D && SIZES_8UN.some((s) => s.D === saved.D)) setSizeD(saved.D);
        if (saved.k && saved.k >= 1 && saved.k <= 5) setK(saved.k);
        if (saved.lc && typeof saved.lc === 'object') {
          setLc({ ...DEFAULT_LOAD_CASE, ...saved.lc, applied: false });
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ D: sizeD, k, lc: { ...lc, applied: false } }));
    } catch {
      // ignore
    }
  }, [sizeD, k, lc, hydrated]);

  const size = SIZES_8UN.find((s) => s.D === sizeD) ?? SIZES_8UN[1];
  const fit = useMemo(() => computeFit(size), [size]);

  // radial engagement as drawn at LMC/LMC — warns when exaggeration makes threads disengage
  const drawnEngagement = useMemo(() => {
    const d = visualDims(fit, k);
    return (d.bolt.LMC.major - d.nut.LMC.minor) / 2 / fit.basicEngagement;
  }, [fit, k]);

  // ---- working load
  const grip = effectiveGrip(lc, fit.D);
  const lens = useMemo(() => boltLengths(fit.D, fit.P, grip), [fit, grip]);
  const boltMat = resolveBolt(lc, fit.D);
  const nutMat = resolveNut(lc);
  const Flbf = Math.max(0, forceLbf(lc) || 0);
  const res = useMemo(
    () =>
      computeStrength(fit, lens, Flbf, { ...boltMat }, { Sy: nutMat.Sy, Su: nutMat.Su }),
    [fit, lens, Flbf, boltMat.Sy, boltMat.Su, boltMat.E, boltMat.nu, nutMat.Sy, nutMat.Su]
  );
  // the 3D / 2D pictures use the outermost visible bolt and innermost visible nut
  const pairBolt: Cond = vis.boltMMC || !vis.boltLMC ? 'MMC' : 'LMC';
  const pairNut: Cond = vis.nutMMC || !vis.nutLMC ? 'MMC' : 'LMC';
  const pairFit = useMemo(
    () => flankFit(fit, pairBolt, pairNut, Flbf, res.As, boltMat.E, boltMat.nu, lens.LE),
    [fit, pairBolt, pairNut, Flbf, res.As, boltMat.E, boltMat.nu, lens.LE]
  );
  const sp = useMemo(
    () => stretchParams(lens, fit.P, res, pairFit, boltMat.nu, k, lc.M),
    [lens, fit.P, res, pairFit, boltMat.nu, k, lc.M]
  );
  const load = useMemo(() => ({ applied: lc.applied, params: sp }), [lc.applied, sp]);
  const loaded2D = useMemo(
    () => (lc.applied ? { params: stretchParams(lens, fit.P, res, pairFit, boltMat.nu, k, k), eB: lens.eB } : null),
    [lc.applied, lens, fit.P, res, pairFit, boltMat.nu, k]
  );

  const setCond = (key: CondKey | 'basic' | 'clearance', v: boolean) =>
    setVis((prev) => ({ ...prev, [key]: v }));

  const requestView = (kind: ViewKind) => {
    if (kind === 'detail' && section === 'none') setSection('half');
    setView((v) => ({ kind, n: v.n + 1 }));
  };

  return (
    <div className="space-y-6">
      {/* inputs */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Nominal size (8 tpi)
          </span>
          <select
            value={size.D}
            onChange={(e) => setSizeD(Number(e.target.value))}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            {SIZES_8UN.map((s) => (
              <option key={s.D} value={s.D}>
                {s.label}&quot;-8 {s.series}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="block text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Designation
          </span>
          <div className="flex flex-wrap gap-1.5 font-mono text-sm">
            <span className="rounded px-2 py-1 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200">
              {fit.designationExt}
            </span>
            <span className="rounded px-2 py-1 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
              {fit.designationInt}
            </span>
          </div>
        </div>
        <label className="block min-w-[14rem] flex-1 max-w-sm">
          <span className="flex justify-between text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            <span>Tolerance magnification</span>
            <span className="font-mono normal-case text-slate-700 dark:text-slate-200">
              ×{k}
              {k === 1 ? ' (true scale)' : ''}
            </span>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={0.5}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            className="w-full accent-accent-600"
            aria-label="Tolerance magnification factor"
          />
        </label>
      </div>

      <LoadCaseInputs
        fit={fit}
        lc={lc}
        setLc={setLc}
        res={res}
        lens={lens}
        pair={{ bolt: pairBolt, nut: pairNut, gapEnd: pairFit.gapEnd }}
      />

      {/* 3D viewer */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <Segmented
            label="View"
            value={config}
            onChange={setConfig}
            options={[
              { value: 'assembled', label: 'Assembled' },
              { value: 'exploded', label: 'Exploded' },
              { value: 'bolt', label: 'Bolt only' },
              { value: 'nut', label: 'Nut only' },
            ]}
          />
          <Segmented
            label="Section"
            value={section}
            onChange={setSection}
            options={[
              { value: 'none', label: 'Off' },
              { value: 'half', label: 'Half' },
              { value: 'quarter', label: 'Quarter' },
            ]}
          />
          <div className="flex flex-wrap gap-1.5 ml-auto">
            <ToolButton onClick={() => requestView('fit')} title="Fit visible parts">
              <Maximize2 size={13} /> Fit
            </ToolButton>
            <ToolButton onClick={() => requestView('iso')} title="Isometric view">
              <Move3d size={13} /> Iso
            </ToolButton>
            <ToolButton onClick={() => requestView('front')} title="Look straight at the section plane">
              <RectangleHorizontal size={13} /> Front
            </ToolButton>
            <ToolButton onClick={() => requestView('detail')} title="Zoom to the thread flanks on the section">
              <Crosshair size={13} /> Thread detail
            </ToolButton>
          </div>
        </div>

        <div className="relative h-[420px] md:h-[540px] bg-slate-100 dark:bg-[#0f1318]">
          <ThreadViewer
            fit={fit}
            k={k}
            config={config}
            section={section}
            vis={vis}
            dark={dark}
            view={view}
            grip={grip}
            load={load}
            className="absolute inset-0"
          />
          <div className="pointer-events-none absolute left-3 top-2 text-[11px] leading-snug text-slate-600 dark:text-slate-300 font-mono">
            <div>
              {fit.designationExt} / {fit.designationInt}
            </div>
            <div>deviations from basic ×{k}{k === 1 ? ' (true scale)' : ' — not to scale'}</div>
          </div>
          <div className="pointer-events-none absolute left-3 bottom-2 text-[10px] text-slate-500 dark:text-slate-400">
            drag: rotate · right-drag: pan · wheel: zoom
          </div>
        </div>

        <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <Toggle
              checked={vis.boltMMC}
              onChange={(v) => setCond('boltMMC', v)}
              color={PALETTE.boltMMC.fill}
              label="Bolt 2A · MMC"
              sub={`d ${fmtIn(fit.ext.majorMax)} · d₂ ${fmtIn(fit.ext.pitchMax)}`}
            />
            <Toggle
              checked={vis.boltLMC}
              onChange={(v) => setCond('boltLMC', v)}
              color={PALETTE.boltLMC.fill}
              label="Bolt 2A · LMC"
              sub={`d ${fmtIn(fit.ext.majorMin)} · d₂ ${fmtIn(fit.ext.pitchMin)}`}
            />
            <Toggle
              checked={vis.nutMMC}
              onChange={(v) => setCond('nutMMC', v)}
              color={PALETTE.nutMMC.fill}
              label="Nut 2B · MMC"
              sub={`D₁ ${fmtIn(fit.int.minorMin, 3)} · D₂ ${fmtIn(fit.int.pitchMin)}`}
            />
            <Toggle
              checked={vis.nutLMC}
              onChange={(v) => setCond('nutLMC', v)}
              color={PALETTE.nutLMC.fill}
              label="Nut 2B · LMC"
              sub={`D₁ ${fmtIn(fit.int.minorMax, 3)} · D₂ ${fmtIn(fit.int.pitchMax)}`}
            />
            <Toggle
              checked={vis.clearance}
              onChange={(v) => setCond('clearance', v)}
              color={PALETTE.clearance}
              label="Clearance"
              sub="gap between visible profiles"
            />
            <Toggle
              checked={vis.basic}
              onChange={(v) => setCond('basic', v)}
              color={dark ? PALETTE.basic.dark : PALETTE.basic.light}
              label="Basic profile"
              sub="B1.1 basic form"
              dashed
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 mr-1">Quick:</span>
            <ToolButton
              onClick={() => setVis((p) => ({ ...p, boltMMC: true, nutMMC: true, boltLMC: false, nutLMC: false }))}
              title="Largest bolt in smallest nut"
            >
              MMC pair · min clearance
            </ToolButton>
            <ToolButton
              onClick={() => setVis((p) => ({ ...p, boltMMC: false, nutMMC: false, boltLMC: true, nutLMC: true }))}
              title="Smallest bolt in largest nut"
            >
              LMC pair · max clearance
            </ToolButton>
            <ToolButton
              onClick={() => setVis((p) => ({ ...p, boltMMC: true, nutMMC: true, boltLMC: true, nutLMC: true }))}
              title="Show both conditions: the MMC colour remains visible only as the tolerance band"
            >
              All conditions
            </ToolButton>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            With both conditions visible the LMC solid is drawn over the MMC solid, so the MMC colour shows
            only as the band of material between the two limits (the tolerance zone). The green fill is the
            free space between the outermost visible bolt and the innermost visible nut: MMC pair = minimum
            clearance (allowance es = {fmtIn(fit.ext.allowance)} in on pitch diameter), LMC pair = maximum
            clearance ({fmtIn(fit.clearance.pitch.max)} in).
          </p>
          {drawnEngagement < 0.3 && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle size={13} className="mt-px shrink-0" />
              At ×{k} the exaggerated LMC bolt crest barely reaches the LMC nut crest in the drawing (
              {Math.max(0, drawnEngagement * 100).toFixed(0)}% of basic engagement drawn). The real LMC/LMC
              engagement is {((fit.clearance.engagement.min / fit.basicEngagement) * 100).toFixed(0)}% of
              basic — use ×1…×2 to judge thread depth.
            </p>
          )}
        </div>
      </div>

      {/* 2D detail */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <header className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold">
            Thread profile detail{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              {lc.applied
                ? `— last engaged threads (far end of the nut) under F, pair ${pairBolt}/${pairNut}, deviations and thread strain ×${k}`
                : `— axial section over two pitches, 1:1 aspect, deviations ×${k}`}
            </span>
          </h3>
        </header>
        <div className="p-3">
          <ProfileDetail fit={fit} k={k} vis={vis} loaded={loaded2D} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        <header className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold">
            Flank gaps along the engagement{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">
              — under F = {(Flbf / 224.80894).toFixed(1)} kN, true scale, first engaged thread bearing
            </span>
          </h3>
        </header>
        <div className="p-3">
          <FlankGapChart
            fits={res.fit}
            eps={res.epsT}
            LE={lens.LE}
            P={fit.P}
            unit={lc.unit === 'kN' ? 'mm' : 'in'}
            dark={dark}
          />
        </div>
      </section>

      <StrengthResults fit={fit} res={res} lens={lens} lc={lc} />

      <ToleranceTables fit={fit} />
    </div>
  );
}
