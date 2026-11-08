import { Formula } from '@/components/Formula';
import { SIZES_8UN, computeFit, fmtIn, fmtMm, roundTo } from './b11';

/** Worked example, computed live from the same functions as the calculator. */
export default function Examples() {
  const size = SIZES_8UN.find((s) => s.D === 1.125)!;
  const f = computeFit(size);
  const { D, P } = f;
  const a = 0.0015 * Math.cbrt(D);
  const b = 0.0015 * Math.sqrt(f.LE);
  const c = 0.015 * Math.cbrt(P * P);
  const x = (v: number, dp = 4) => fmtIn(v, dp);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Example 1 — {f.designationExt} bolt with {f.designationInt} nut
      </h3>
      <p>
        D = {x(D)} in, n = 8 tpi → P = {x(P)} in. Basic pitch diameter E = D − 0.649519·P ={' '}
        <b>{x(f.E)}</b> in. Basic minor diameter D₁ = D − 1.082532·P = <b>{x(f.D1)}</b> in.
      </p>

      <h4 className="font-medium text-slate-900 dark:text-slate-100">1. Pitch-diameter tolerance, class 2A (LE = D)</h4>
      <Formula
        tex={`T_{d2} = 0.0015\\sqrt[3]{${D}} + 0.0015\\sqrt{${D}} + 0.015\\sqrt[3]{${P}^2} = ${a.toFixed(6)} + ${b.toFixed(6)} + ${c.toFixed(6)} = ${f.td2Raw.toFixed(6)} \\rightarrow ${x(f.ext.pitchTol)}`}
      />

      <h4 className="font-medium text-slate-900 dark:text-slate-100">2. Allowance and the other tolerances</h4>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          es = 0.300 × {f.td2Raw.toFixed(6)} = {(0.3 * f.td2Raw).toFixed(6)} → <b>{x(f.ext.allowance)}</b> in
        </li>
        <li>
          T<sub>D2</sub> (2B) = 1.300 × {f.td2Raw.toFixed(6)} = {(1.3 * f.td2Raw).toFixed(6)} →{' '}
          <b>{x(f.int.pitchTol)}</b> in
        </li>
        <li>
          T<sub>d</sub> (2A) = 0.060·∛P² = <b>{x(f.ext.majorTol)}</b> in
        </li>
        <li>
          T<sub>D1</sub> (2B) = 0.25·P − 0.40·P² = <b>{x(f.int.minorTol)}</b> in
        </li>
      </ul>

      <h4 className="font-medium text-slate-900 dark:text-slate-100">3. Limits of size</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Feature</th>
              <th className="text-left px-3 py-2 font-medium">Calculation</th>
              <th className="text-right px-3 py-2 font-medium">[in]</th>
              <th className="text-right px-3 py-2 font-medium">[mm]</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {[
              ['d max (bolt MMC)', `${x(D)} − ${x(f.ext.allowance)}`, f.ext.majorMax],
              ['d min (bolt LMC)', `${x(f.ext.majorMax)} − ${x(f.ext.majorTol)}`, f.ext.majorMin],
              ['d₂ max (bolt MMC)', `${x(roundTo(f.E, 4))} − ${x(f.ext.allowance)}`, f.ext.pitchMax],
              ['d₂ min (bolt LMC)', `${x(f.ext.pitchMax)} − ${x(f.ext.pitchTol)}`, f.ext.pitchMin],
              ['d₃ max UNR (ref.)', `${x(f.ext.pitchMax)} − 0.57735·${P}`, f.ext.minorMaxUNR],
              ['D₁ min (nut MMC)', `D₁ basic → 3 dp`, f.int.minorMin],
              ['D₁ max (nut LMC)', `${x(f.D1)} + ${x(f.int.minorTol)} → 3 dp`, f.int.minorMax],
              ['D₂ min (nut MMC)', `E`, f.int.pitchMin],
              ['D₂ max (nut LMC)', `${x(f.int.pitchMin)} + ${x(f.int.pitchTol)}`, f.int.pitchMax],
              ['D min (nut)', `D`, f.int.majorMin],
            ].map(([name, calc, v]) => (
              <tr key={name as string} className="border-t border-slate-100 dark:border-slate-800/60">
                <td className="px-3 py-1.5 font-sans text-sm">{name}</td>
                <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">{calc}</td>
                <td className="px-3 py-1.5 text-right">{x(v as number, (name as string).startsWith('D₁') ? 3 : 4)}</td>
                <td className="px-3 py-1.5 text-right text-slate-500 dark:text-slate-400">{fmtMm(v as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="font-medium text-slate-900 dark:text-slate-100">4. Clearance on pitch diameter</h4>
      <Formula
        tex={`c_{min} = ${x(f.int.pitchMin)} - ${x(f.ext.pitchMax)} = ${x(f.clearance.pitch.min)}\\ \\text{in} \\;(= es)`}
      />
      <Formula
        tex={`c_{max} = ${x(f.int.pitchMax)} - ${x(f.ext.pitchMin)} = ${x(f.clearance.pitch.max)}\\ \\text{in}`}
      />
      <p>
        Axial play with the flanks centred: {x(f.clearance.axialPlay.min)} in (MMC/MMC) to{' '}
        {x(f.clearance.axialPlay.max)} in (LMC/LMC). Radial thread engagement drops from{' '}
        {x(f.clearance.engagement.max)} in to {x(f.clearance.engagement.min)} in (basic 5H/8 ={' '}
        {x(f.basicEngagement)} in), i.e. to{' '}
        {((f.clearance.engagement.min / f.basicEngagement) * 100).toFixed(0)}% of basic.
      </p>
      <blockquote className="border-l-2 border-accent-400 pl-3 text-slate-600 dark:text-slate-400 italic">
        In the Calculator tab choose 1-1/8&quot;-8 UN, turn on the half section and press “Thread detail”.
        The MMC pair shows the minimum clearance; switch to the LMC pair to see the maximum.
      </blockquote>
    </div>
  );
}
