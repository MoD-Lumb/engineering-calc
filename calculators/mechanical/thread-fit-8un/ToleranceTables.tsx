'use client';

import type { ReactNode } from 'react';
import { CopyButton } from '@/components/CopyButton';
import { rowsToTSV } from '@/lib/format';
import { fmtIn, fmtMm, type ThreadFit } from './b11';
import { PALETTE } from './viewTypes';

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-sm align-middle mr-1.5 ring-1 ring-black/10"
      style={{ background: color }}
    />
  );
}

function Card({ title, children, copy }: { title: ReactNode; children: ReactNode; copy?: string }) {
  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-semibold">{title}</h3>
        {copy && <CopyButton label="Copy table" text={copy} />}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const th = 'px-3 py-2 font-medium text-left whitespace-nowrap';
const thR = 'px-3 py-2 font-medium text-right whitespace-nowrap';
const td = 'px-3 py-1.5 whitespace-nowrap';
const tdN = 'px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap';
const tdMm = 'px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-500 dark:text-slate-400';
const theadCls = 'text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400';
const rowCls = 'border-t border-slate-100 dark:border-slate-800/60';
const groupCls = 'border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30';

interface LimitRow {
  feature: string;
  symbol: string;
  mmc: number;
  lmc: number;
  tol: number | null;
  mmcIsMax: boolean;
  note?: string;
  dp?: number;
}

export function ToleranceTables({ fit }: { fit: ThreadFit }) {
  const { ext, int, clearance: c } = fit;

  const boltRows: LimitRow[] = [
    { feature: 'Major diameter', symbol: 'd', mmc: ext.majorMax, lmc: ext.majorMin, tol: ext.majorTol, mmcIsMax: true },
    { feature: 'Pitch diameter', symbol: 'd₂', mmc: ext.pitchMax, lmc: ext.pitchMin, tol: ext.pitchTol, mmcIsMax: true },
    {
      feature: 'Minor diameter (UNR)',
      symbol: 'd₃',
      mmc: ext.minorMaxUNR,
      lmc: ext.minorMinRef,
      tol: null,
      mmcIsMax: true,
      note: 'Max is a B1.1 reference value; min † = d₂ min − 0.57735 P',
    },
  ];
  const nutRows: LimitRow[] = [
    { feature: 'Minor diameter', symbol: 'D₁', mmc: int.minorMin, lmc: int.minorMax, tol: int.minorTol, mmcIsMax: false, dp: fit.nutOversize ? 4 : 3 },
    { feature: 'Pitch diameter', symbol: 'D₂', mmc: int.pitchMin, lmc: int.pitchMax, tol: int.pitchTol, mmcIsMax: false },
    {
      feature: 'Major diameter',
      symbol: 'D',
      mmc: int.majorMin,
      lmc: int.majorMaxRef,
      tol: null,
      mmcIsMax: false,
      note: 'Min per B1.1; max † = D₂ max + 0.649519 P (set by the tap)',
    },
  ];

  const limitsTsv = rowsToTSV([
    ['Part', 'Feature', 'Symbol', 'MMC [in]', 'LMC [in]', 'Tol [in]', 'MMC [mm]', 'LMC [mm]'],
    ...boltRows.map((r) => [
      fit.designationExt,
      r.feature,
      r.symbol,
      fmtIn(r.mmc, r.dp),
      fmtIn(r.lmc, r.dp),
      r.tol === null ? '' : fmtIn(r.tol),
      fmtMm(r.mmc),
      fmtMm(r.lmc),
    ]),
    [fit.designationExt, 'Allowance', 'es', '', '', fmtIn(ext.allowance), '', ''],
    ...nutRows.map((r) => [
      fit.designationInt,
      r.feature,
      r.symbol,
      fmtIn(r.mmc, r.dp),
      fmtIn(r.lmc, r.dp),
      r.tol === null ? '' : fmtIn(r.tol),
      fmtMm(r.mmc),
      fmtMm(r.lmc),
    ]),
  ]);

  const clrRows: Array<{ feature: string; formula: string; mmc: number; lmc: number; note?: string }> = [
    { feature: 'Pitch diameter clearance', formula: 'D₂ − d₂', mmc: c.pitch.min, lmc: c.pitch.max },
    { feature: 'Major diameter clearance', formula: 'D − d', mmc: c.major.min, lmc: c.major.max, note: '†' },
    { feature: 'Minor diameter clearance', formula: 'D₁ − d₃', mmc: c.minor.min, lmc: c.minor.max, note: '†' },
    { feature: 'Axial play (flanks centred)', formula: '(D₂ − d₂)·tan 30°', mmc: c.axialPlay.min, lmc: c.axialPlay.max },
    { feature: 'Radial thread engagement', formula: '(d − D₁)/2', mmc: c.engagement.max, lmc: c.engagement.min },
  ];
  const clrTsv = rowsToTSV([
    ['Feature', 'Formula', 'MMC/MMC [in]', 'LMC/LMC [in]', 'MMC/MMC [mm]', 'LMC/LMC [mm]'],
    ...clrRows.map((r) => [r.feature, r.formula, fmtIn(r.mmc), fmtIn(r.lmc), fmtMm(r.mmc), fmtMm(r.lmc)]),
  ]);

  const basicRows: Array<[string, string, number, string?]> = [
    ['Basic major diameter', 'D', fit.D],
    ['Pitch (8 threads per inch)', 'P = 1/n', fit.P],
    ['Height of fundamental triangle', 'H = 0.866025 P', fit.H],
    ['Basic pitch diameter', 'E = D − 0.649519 P', fit.E],
    ['Basic minor diameter (internal)', 'D₁ = D − 1.082532 P', fit.D1],
    ['Basic thread engagement', '5H/8', fit.basicEngagement],
    ['Length of engagement (tolerance basis)', 'LE = D', fit.LE],
    ['Allowance, class 2A', 'es = 0.300·Td₂', ext.allowance],
  ];
  const basicTsv = rowsToTSV([
    ['Quantity', 'Symbol / formula', 'Value [in]', 'Value [mm]'],
    ...basicRows.map(([q, s, v]) => [q, s, fmtIn(v), fmtMm(v)]),
  ]);

  const LimitBody = ({ rows, mmcColor, lmcColor }: { rows: LimitRow[]; mmcColor: string; lmcColor: string }) => (
    <>
      {rows.map((r) => (
        <tr key={r.feature} className={rowCls}>
          <td className={td}>
            {r.feature}
            {r.note && (
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 whitespace-normal max-w-[18rem]">
                {r.note}
              </span>
            )}
          </td>
          <td className={td + ' font-mono text-slate-500 dark:text-slate-400'}>{r.symbol}</td>
          <td className={tdN}>
            <Swatch color={mmcColor} />
            {fmtIn(r.mmc, r.dp)}
            <span className="ml-1 text-[10px] text-slate-400">{r.mmcIsMax ? 'max' : 'min'}</span>
          </td>
          <td className={tdN}>
            <Swatch color={lmcColor} />
            {fmtIn(r.lmc, r.dp)}
            <span className="ml-1 text-[10px] text-slate-400">{r.mmcIsMax ? 'min' : 'max'}</span>
            {r.tol === null && <span className="text-slate-400">†</span>}
          </td>
          <td className={tdN}>{r.tol === null ? '—' : fmtIn(r.tol)}</td>
          <td className={tdMm}>{fmtMm(r.mmc)}</td>
          <td className={tdMm}>{fmtMm(r.lmc)}</td>
        </tr>
      ))}
    </>
  );

  return (
    <div className="space-y-5">
      <Card
        title={
          <>
            Limits of size — {fit.designationExt} / {fit.designationInt}{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">(ASME B1.1)</span>
          </>
        }
        copy={limitsTsv}
      >
        <table className="w-full text-sm">
          <thead className={theadCls}>
            <tr>
              <th className={th}>Feature</th>
              <th className={th}>Sym.</th>
              <th className={thR}>MMC [in]</th>
              <th className={thR}>LMC [in]</th>
              <th className={thR}>Tol. [in]</th>
              <th className={thR}>MMC [mm]</th>
              <th className={thR}>LMC [mm]</th>
            </tr>
          </thead>
          <tbody>
            <tr className={groupCls}>
              <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold">
                Bolt — external thread {fit.designationExt}
                <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                  allowance es = {fmtIn(ext.allowance)} in ({fmtMm(ext.allowance)} mm) · MMC = maximum size
                </span>
              </td>
            </tr>
            <LimitBody rows={boltRows} mmcColor={PALETTE.boltMMC.fill} lmcColor={PALETTE.boltLMC.fill} />
            <tr className={groupCls}>
              <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold">
                Nut — internal thread {fit.designationInt}
                {fit.nutOversize > 0 && (
                  <span className="ml-2 font-normal text-fuchsia-700 dark:text-fuchsia-300">
                    oversize +{fmtIn(fit.nutOversize)} in applied to minor, pitch and major diameters (not 2B
                    gauge-conforming)
                  </span>
                )}
                <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                  no allowance · MMC = minimum size
                </span>
              </td>
            </tr>
            <LimitBody rows={nutRows} mmcColor={PALETTE.nutMMC.fill} lmcColor={PALETTE.nutLMC.fill} />
          </tbody>
        </table>
      </Card>

      <Card title="Clearance between bolt and nut (diametral unless noted)" copy={clrTsv}>
        <table className="w-full text-sm">
          <thead className={theadCls}>
            <tr>
              <th className={th}>Feature</th>
              <th className={th}>Formula</th>
              <th className={thR}>MMC / MMC [in]</th>
              <th className={thR}>LMC / LMC [in]</th>
              <th className={thR}>MMC / MMC [mm]</th>
              <th className={thR}>LMC / LMC [mm]</th>
            </tr>
          </thead>
          <tbody>
            {clrRows.map((r) => (
              <tr key={r.feature} className={rowCls}>
                <td className={td}>
                  {r.feature}
                  {r.note && <span className="text-slate-400"> {r.note}</span>}
                </td>
                <td className={td + ' font-mono text-xs text-slate-500 dark:text-slate-400'}>{r.formula}</td>
                <td className={tdN}>{fmtIn(r.mmc)}</td>
                <td className={tdN}>{fmtIn(r.lmc)}</td>
                <td className={tdMm}>{fmtMm(r.mmc)}</td>
                <td className={tdMm}>{fmtMm(r.lmc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60">
          MMC/MMC = tightest fit (largest bolt in smallest nut, minimum clearance = allowance es). LMC/LMC =
          loosest fit (maximum clearance). Thread engagement is the opposite: largest at MMC/MMC, smallest at
          LMC/LMC (basic 5H/8 = {fmtIn(fit.basicEngagement)} in).
        </p>
      </Card>

      <Card title="Basic dimensions" copy={basicTsv}>
        <table className="w-full text-sm">
          <thead className={theadCls}>
            <tr>
              <th className={th}>Quantity</th>
              <th className={th}>Symbol / formula</th>
              <th className={thR}>[in]</th>
              <th className={thR}>[mm]</th>
            </tr>
          </thead>
          <tbody>
            {basicRows.map(([q, s, v]) => (
              <tr key={q} className={rowCls}>
                <td className={td}>{q}</td>
                <td className={td + ' font-mono text-xs text-slate-500 dark:text-slate-400'}>{s}</td>
                <td className={tdN}>{fmtIn(v)}</td>
                <td className={tdMm}>{fmtMm(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        † Not toleranced by ASME B1.1 — derived from the thread form so the model has a defined least-material
        boundary (bolt root follows the pitch diameter with the UNR root; nut root follows the pitch diameter
        with a P/8 flat). Internal minor diameters of class 2B are published to 3 decimals, as in the B1.1
        tables.
      </p>
    </div>
  );
}
