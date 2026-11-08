'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Scissors,
  Tag,
  Waves,
  X,
} from 'lucide-react';
import {
  EQUIPMENT,
  STREAMS,
  STREAM_ORDER,
  SYSTEMS,
  SYSTEM_ORDER,
  type EquipmentId,
} from './equipment';
import { createPlantScene, type LabelMode, type PlantScene, type StreamFocus } from './scene';

const TOUR_STEP_MS = 9000;

// Nominal operating point used to scale the flow animation.
const NOMINAL = { q: 2000, wc: 30, gor: 120 };

function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function fmt(v: number, digits = 0) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).replace(/,/g, ' ');
}

export default function PlantViewer() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlantScene | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EquipmentId | null>(null);
  const [focus, setFocus] = useState<StreamFocus>('all');
  const [cutaway, setCutaway] = useState(true);
  const [underground, setUnderground] = useState(true);
  const [labels, setLabels] = useState<LabelMode>('numbers');
  const [animate, setAnimate] = useState(true);
  const [touring, setTouring] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [balance, setBalance] = useState(NOMINAL);

  // ---------------------------------------------------------------- scene
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let scene: PlantScene | null = null;
    try {
      scene = createPlantScene(host, { dark: isDarkMode(), onSelect: (id) => setSelected(id) });
      sceneRef.current = scene;
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    const mo = new MutationObserver(() => scene?.setDark(isDarkMode()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mo.disconnect();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) sceneRef.current?.select(selected, true);
  }, [selected, ready]);
  useEffect(() => {
    if (ready) sceneRef.current?.setStreamFocus(focus);
  }, [focus, ready]);
  useEffect(() => {
    if (ready) sceneRef.current?.setCutaway(cutaway);
  }, [cutaway, ready]);
  useEffect(() => {
    if (ready) sceneRef.current?.setUnderground(underground);
  }, [underground, ready]);
  useEffect(() => {
    if (ready) sceneRef.current?.setLabels(labels);
  }, [labels, ready]);
  useEffect(() => {
    if (ready) sceneRef.current?.setAnimate(animate);
  }, [animate, ready]);

  // ------------------------------------------------------------- balance
  const results = useMemo(() => {
    const q = Math.max(balance.q, 0);
    const wc = Math.min(Math.max(balance.wc, 0), 100) / 100;
    const gor = Math.max(balance.gor, 0);
    const oil = q * (1 - wc);
    const water = q * wc;
    const gas = gor * oil;
    return { oil, water, gas, wor: oil > 0 ? water / oil : NaN, glr: q > 0 ? gas / q : NaN };
  }, [balance]);

  useEffect(() => {
    if (!ready) return;
    const nOil = NOMINAL.q * (1 - NOMINAL.wc / 100);
    const nWater = NOMINAL.q * (NOMINAL.wc / 100);
    const nGas = NOMINAL.gor * nOil;
    const clamp = (v: number) => Math.min(Math.max(v, 0), 3);
    sceneRef.current?.setFlowRates({
      well: clamp(balance.q / NOMINAL.q),
      oil: clamp(results.oil / nOil),
      water: clamp(results.water / nWater),
      gas: clamp(results.gas / nGas),
    });
  }, [balance, results, ready]);

  // ---------------------------------------------------------------- tour
  const index = selected ? EQUIPMENT.findIndex((e) => e.id === selected) : -1;
  const current = index >= 0 ? EQUIPMENT[index] : null;

  const step = useCallback((dir: 1 | -1) => {
    setSelected((s) => {
      const i = s ? EQUIPMENT.findIndex((e) => e.id === s) : -1;
      const n = EQUIPMENT.length;
      const next = i < 0 ? (dir === 1 ? 0 : n - 1) : (i + dir + n) % n;
      return EQUIPMENT[next].id;
    });
  }, []);

  useEffect(() => {
    if (!touring) return;
    const t = window.setInterval(() => step(1), TOUR_STEP_MS);
    return () => window.clearInterval(t);
  }, [touring, step, selected]);

  function startTour() {
    setSelected(EQUIPMENT[0].id);
    setTouring(true);
  }

  // ----------------------------------------------------------- fullscreen
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  async function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (pseudoFullscreen) {
      setPseudoFullscreen(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        // fall through to the CSS fallback
      }
    }
    setPseudoFullscreen(true);
  }
  const isFull = fullscreen || pseudoFullscreen;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setTouring(false);
      step(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setTouring(false);
      step(-1);
    } else if (e.key === 'Escape') {
      setTouring(false);
      setSelected(null);
      setPseudoFullscreen(false);
    }
  }

  function selectFromList(id: EquipmentId) {
    setTouring(false);
    setSelected(id);
    wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const labelCycle: Record<LabelMode, LabelMode> = { numbers: 'names', names: 'off', off: 'numbers' };
  const labelText: Record<LabelMode, string> = { numbers: 'Numbers', names: 'Names', off: 'Off' };

  return (
    <div className="space-y-4">
      <style>{LABEL_CSS}</style>

      <div
        ref={wrapRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={
          'plant-viewer relative scroll-mt-20 overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#e4ebf2] dark:bg-[#0f1419] focus:outline-none ' +
          (pseudoFullscreen ? 'fixed inset-0 z-50 h-auto rounded-none' : 'rounded-lg h-[520px] md:h-[620px]')
        }
        aria-label="Interactive 3D model of an oil production plant"
      >
        <div ref={hostRef} className="absolute inset-0" />

        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-sm text-slate-500 dark:text-slate-400">
            Building the 3D plant…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-600 dark:text-slate-300">
            <div>
              <p className="font-medium mb-1">The 3D view could not start.</p>
              <p className="text-slate-500 dark:text-slate-400">
                Your browser or device may not support WebGL. The Theory and Examples tabs still explain the
                process. ({error})
              </p>
            </div>
          </div>
        )}

        {/* toolbar */}
        <div className="absolute z-10 left-2 top-2 right-2 flex flex-wrap items-start gap-1.5 pointer-events-none">
          <div className="flex flex-wrap gap-1 rounded-lg bg-white/85 dark:bg-slate-900/85 backdrop-blur p-1 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 pointer-events-auto">
            <ToolButton active={cutaway} onClick={() => setCutaway((v) => !v)} title="Cut vessels open to show what is inside">
              <Scissors size={14} /> <span className="hidden sm:inline">Cutaway</span>
            </ToolButton>
            <ToolButton active={underground} onClick={() => setUnderground((v) => !v)} title="Make the ground see-through to show wells and reservoir">
              <Layers size={14} /> <span className="hidden sm:inline">Underground</span>
            </ToolButton>
            <ToolButton active={labels !== 'off'} onClick={() => setLabels((l) => labelCycle[l])} title="Cycle labels: numbers → names → off">
              <Tag size={14} /> <span className="hidden sm:inline">Labels: {labelText[labels]}</span>
            </ToolButton>
            <ToolButton active={animate} onClick={() => setAnimate((v) => !v)} title="Pause or resume the flow animation">
              {animate ? <Pause size={14} /> : <Play size={14} />} <span className="hidden sm:inline">Flow</span>
            </ToolButton>
            <ToolButton onClick={() => sceneRef.current?.resetView()} title="Reset the camera">
              <Home size={14} /> <span className="hidden sm:inline">View</span>
            </ToolButton>
            <ToolButton onClick={toggleFullscreen} title={isFull ? 'Exit full screen' : 'Full screen'}>
              {isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </ToolButton>
          </div>
          {!current && ready && (
            <button
              type="button"
              onClick={startTour}
              className="pointer-events-auto ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent-600 hover:bg-accent-700 text-white px-3 py-1.5 text-xs font-medium shadow-sm"
            >
              <Play size={14} /> <span className="hidden sm:inline">Guided</span> tour
            </button>
          )}
        </div>

        {/* stream legend = focus filter */}
        <div
          className={
            'absolute z-10 left-2 bottom-2 rounded-lg bg-white/85 dark:bg-slate-900/85 backdrop-blur p-2 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 ' +
            (current ? 'hidden md:block' : '')
          }
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 px-1">
            Streams <span className="normal-case font-normal">(click to highlight)</span>
          </div>
          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
            {STREAM_ORDER.map((k) => {
              const on = focus === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFocus((f) => (f === k ? 'all' : k))}
                  className={
                    'flex items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors ' +
                    (on
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : focus !== 'all'
                        ? 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')
                  }
                  aria-pressed={on}
                >
                  <span className="h-2 w-4 shrink-0 rounded-sm" style={{ background: STREAMS[k].color }} />
                  {STREAMS[k].label.replace(' (oil + gas + water)', '')}
                </button>
              );
            })}
          </div>
        </div>

        {!current && ready && (
          <div className="absolute z-10 right-2 bottom-2 hidden md:block rounded-md bg-white/70 dark:bg-slate-900/70 px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400">
            Drag to orbit · Right-drag to pan · Scroll to zoom · Click equipment for details
          </div>
        )}

        {/* info panel */}
        {current && (
          <aside
            className={
              'absolute z-20 flex flex-col rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg ring-1 ring-slate-200 dark:ring-slate-700 ' +
              'inset-x-2 bottom-2 max-h-[58%] md:inset-x-auto md:right-2 md:top-14 md:bottom-2 md:max-h-none md:w-[340px]'
            }
            aria-live="polite"
          >
            <div className="flex items-start gap-2 p-3 pb-2 border-b border-slate-200 dark:border-slate-800">
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                style={{ background: SYSTEMS[current.system].color }}
              >
                {current.n}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-snug">{current.name}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{SYSTEMS[current.system].label}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTouring(false);
                  setSelected(null);
                }}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close details"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
              <p>{current.summary}</p>
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  How it works
                </h4>
                <ul className="list-disc pl-4 space-y-1">
                  {current.how.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
              {current.look && (
                <p className="rounded-md bg-accent-50 dark:bg-accent-900/30 px-2.5 py-2 text-[12px] text-accent-800 dark:text-accent-200">
                  <span className="font-semibold">In the model: </span>
                  {current.look}
                </p>
              )}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Typical values
                </h4>
                <table className="w-full text-[12px]">
                  <tbody>
                    {current.typical.map(([k, v]) => (
                      <tr key={k} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td className="py-1 pr-2 text-slate-500 dark:text-slate-400">{k}</td>
                        <td className="py-1 text-right font-mono text-[11.5px]">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center gap-1 border-t border-slate-200 dark:border-slate-800 p-2">
              <button
                type="button"
                onClick={() => {
                  setTouring(false);
                  step(-1);
                }}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                type="button"
                onClick={() => setTouring((t) => !t)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {touring ? <Pause size={14} /> : <Play size={14} />} {touring ? 'Pause tour' : 'Auto-play'}
              </button>
              <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
                {current.n} / {EQUIPMENT.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setTouring(false);
                  step(1);
                }}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </aside>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Schematic model of a single-train onshore plant. It is not to scale: the subsurface is compressed and real tanks
        and flares are much larger. Typical values are indicative ranges, not design values. Use ← / → to step through
        the equipment.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* equipment list */}
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-sm font-semibold mb-3">Process flow: what is in the plant</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {SYSTEM_ORDER.map((sys) => (
              <div key={sys}>
                <h4
                  className="text-[11px] font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: SYSTEMS[sys].color }}
                >
                  {SYSTEMS[sys].label}
                </h4>
                <ul className="space-y-0.5">
                  {EQUIPMENT.filter((e) => e.system === sys).map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => selectFromList(e.id)}
                        className={
                          'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors ' +
                          (selected === e.id
                            ? 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')
                        }
                      >
                        <span
                          className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                          style={{ background: SYSTEMS[sys].color }}
                        >
                          {e.n}
                        </span>
                        <span className="truncate">{e.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* plant balance */}
        <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
            <Waves size={15} className="text-accent-600" /> Plant balance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Split of the well stream at standard conditions. The flow animation speed follows these rates.
          </p>
          <div className="space-y-2">
            <NumberField
              label="Liquid rate, Q_L"
              unit="m³/d"
              value={balance.q}
              step={100}
              onChange={(q) => setBalance((b) => ({ ...b, q }))}
            />
            <NumberField
              label="Water cut, WC"
              unit="%"
              value={balance.wc}
              step={5}
              min={0}
              max={100}
              onChange={(wc) => setBalance((b) => ({ ...b, wc }))}
            />
            <NumberField
              label="Gas–oil ratio, GOR"
              unit="Sm³/Sm³"
              value={balance.gor}
              step={10}
              onChange={(gor) => setBalance((b) => ({ ...b, gor }))}
            />
          </div>
          <dl className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            <ResultRow color={STREAMS.oil.color} label="Oil, Q_o" value={fmt(results.oil)} unit="m³/d" />
            <ResultRow color={STREAMS.water.color} label="Water, Q_w" value={fmt(results.water)} unit="m³/d" />
            <ResultRow color={STREAMS.gas.color} label="Gas, Q_g" value={fmt(results.gas / 1000, 1)} unit="10³ Sm³/d" />
            <ResultRow label="Water–oil ratio" value={fmt(results.wor, 2)} unit="–" />
            <ResultRow label="Gas–liquid ratio" value={fmt(results.glr, 1)} unit="Sm³/m³" />
          </dl>
          <button
            type="button"
            onClick={() => setBalance(NOMINAL)}
            className="mt-2 text-xs text-accent-700 dark:text-accent-400 hover:underline"
          >
            Reset to defaults
          </button>
        </section>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-accent-600 text-white hover:bg-accent-700'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')
      }
    >
      {children}
    </button>
  );
}

function NumberField({
  label,
  unit,
  value,
  step,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="flex-1 text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        className="w-24 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1 text-right font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
      />
      <span className="w-16 text-xs text-slate-500 dark:text-slate-400">{unit}</span>
    </label>
  );
}

function ResultRow({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <dt className="flex flex-1 items-center gap-1.5 text-slate-600 dark:text-slate-300">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </dt>
      <dd className="font-mono font-medium tabular-nums">{value}</dd>
      <span className="w-16 text-xs text-slate-500 dark:text-slate-400">{unit}</span>
    </div>
  );
}

// Styles for the DOM labels that three.js positions over the canvas.
const LABEL_CSS = `
.plant-labels .plant-label {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
  color: #0f172a;
  font: 600 11px/1 Inter, ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 120ms ease;
}
.dark .plant-labels .plant-label {
  background: rgba(15, 23, 42, 0.9);
  color: #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.plant-labels .plant-label-num {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--sys);
  color: #fff;
  font-size: 10px;
}
.plant-labels .plant-label-name { display: none; padding-right: 6px; }
.plant-labels.labels-names .plant-label-name,
.plant-labels .plant-label:hover .plant-label-name,
.plant-labels .plant-label.is-hover .plant-label-name,
.plant-labels .plant-label.is-active .plant-label-name { display: inline; }
.plant-labels .plant-label.is-active {
  outline: 2px solid #38bdf8;
  outline-offset: 1px;
  z-index: 5;
}
.plant-labels .plant-label:hover, .plant-labels .plant-label.is-hover { z-index: 6; }
.plant-labels.labels-off .plant-label:not(.is-active) { display: none !important; }
.plant-labels .plant-annot {
  font: 500 10px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
  color: #334155;
  background: rgba(255, 255, 255, 0.7);
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
}
.dark .plant-labels .plant-annot { color: #cbd5e1; background: rgba(15, 23, 42, 0.65); }
.plant-labels .plant-annot-strata { font-style: italic; }
@media (max-width: 640px) {
  .plant-labels .plant-annot { display: none !important; }
}
`;
