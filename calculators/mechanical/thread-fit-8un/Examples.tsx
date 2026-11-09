import { Formula } from '@/components/Formula';
import {
  SIZES_8UN,
  applyCoating,
  applyNutOversize,
  coatingChecks,
  computeFit,
  fmtIn,
  fmtMm,
  roundTo,
  type CoatingSpec,
} from './b11';
import {
  BOLT_GRADES,
  LBF_PER_KN,
  NUT_GRADES,
  boltGradeProps,
  boltLengths,
  computeStrength,
  maxOversize,
  requiredOversize,
} from './strength';

/** Worked example, computed live from the same functions as the calculator. */
export default function Examples() {
  const size = SIZES_8UN.find((s) => s.D === 1.125)!;
  const f = computeFit(size);
  const { D, P } = f;
  const a = 0.0015 * Math.cbrt(D);
  const b = 0.0015 * Math.sqrt(f.LE);
  const c = 0.015 * Math.cbrt(P * P);
  const x = (v: number, dp = 4) => fmtIn(v, dp);

  // Example 2: working load
  const bm = boltGradeProps(BOLT_GRADES.find((g) => g.id === 'B7')!, D);
  const nm = NUT_GRADES.find((g) => g.id === '2H')!;
  const grip = 2.25;
  const F = 50000;
  const lens = boltLengths(D, P, grip);
  const r = computeStrength(f, lens, F, bm, nm);
  const kip = (lbf: number) => (lbf / 1000).toFixed(1);
  const kN = (lbf: number) => (lbf / LBF_PER_KN).toFixed(1);
  const ksi = (psi: number) => (psi / 1000).toFixed(1);
  const sm = r.strip.LMC;
  const mm = r.fit.MMC;
  const lm = r.fit.LMC;

  // Example 3: nut oversize at 90 % of the yield load
  const F3 = 0.9 * r.Fy;
  const r3 = computeStrength(f, lens, F3, bm, nm);
  const req3 = requiredOversize(f, F3, r3.As, bm.E, bm.nu, lens.LE);
  const f3 = applyNutOversize(f, req3.rounded);
  const r3o = computeStrength(f3, lens, F3, bm, nm);
  const max3 = maxOversize(f, lens, F3, bm, nm);
  const gov = (rr: typeof r) => Math.max(rr.strip.LMC.utilBolt, rr.strip.LMC.utilNut);

  // Example 4: zinc-coated bolt, unloaded and at 60 % Fy
  const coat: CoatingSpec = { on: true, bolt: { min: 45, max: 75 }, nut: { min: 0, max: 5 } };
  const s4 = applyCoating(f, coat);
  const chk4 = coatingChecks(f, coat);
  const F4 = 0.6 * r.Fy;
  const r4u = computeStrength(f, lens, 0, bm, nm, s4);
  const r4l = computeStrength(f, lens, F4, bm, nm, s4);
  const req4u = requiredOversize(s4, 0, r.As, bm.E, bm.nu, lens.LE);
  const req4l = requiredOversize(s4, F4, r.As, bm.E, bm.nu, lens.LE);
  const f4o = applyNutOversize(f, req4l.rounded);
  const r4o = computeStrength(f4o, lens, F4, bm, nm, applyCoating(f4o, coat));
  const um = (inch: number) => (inch * 25400).toFixed(0);

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

      <h3 className="pt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
        Example 2 — the same joint under a working load of {kip(F)} kip ({kN(F)} kN)
      </h3>
      <p>
        Bolt ASTM A193 B7: S<sub>y</sub> = {bm.Sy} ksi, S<sub>u</sub> = {bm.Su} ksi (D ≤ 2-1/2 in). Nut A194 2H
        (estimated S<sub>y</sub> = {nm.Sy} ksi). Grip {grip} in, nut fixed, E = {bm.E.toLocaleString('en-US')} ksi.
      </p>

      <h4 className="font-medium text-slate-900 dark:text-slate-100">1. Bolt tension and yield</h4>
      <p>
        S<sub>u</sub> &gt; 100 ksi, so B1.1 uses the high-strength form of the tensile stress area with
        E<sub>s,min</sub> = {x(f.ext.pitchMin)} in:
      </p>
      <Formula
        tex={`A_s = \\pi\\left(\\tfrac{${x(f.ext.pitchMin)}}{2} - \\tfrac{0.16238}{8}\\right)^2 = ${r.As.toFixed(4)}\\ \\text{in}^2 \\quad (\\text{basic form: } ${r.AsBasic.toFixed(4)})`}
      />
      <Formula
        tex={`\\sigma = \\tfrac{${F}}{${r.As.toFixed(4)}} = ${ksi(r.sigma)}\\ \\text{ksi} \\qquad F_y = ${bm.Sy}\\cdot${r.As.toFixed(4)} = ${kip(r.Fy)}\\ \\text{kip} \\qquad \\sigma/S_y = ${(r.utilTension * 100).toFixed(0)}\\%`}
      />

      <h4 className="font-medium text-slate-900 dark:text-slate-100">2. Thread stripping (LMC/LMC, B1.1 worst case)</h4>
      <p>
        L<sub>E</sub> = {x(lens.nutH)} − 2·0.3464·P = {x(lens.LE)} in (nut thickness minus countersinks).
      </p>
      <Formula
        tex={`A_{sb} = \\pi\\cdot8\\cdot${x(lens.LE)}\\cdot${x(f.int.minorMax, 3)}\\left[\\tfrac{1}{16} + 0.57735(${x(f.ext.pitchMin)} - ${x(f.int.minorMax, 3)})\\right] = ${sm.ABolt.toFixed(3)}\\ \\text{in}^2`}
      />
      <Formula
        tex={`A_{sn} = \\pi\\cdot8\\cdot${x(lens.LE)}\\cdot${x(f.ext.majorMin)}\\left[\\tfrac{1}{16} + 0.57735(${x(f.ext.majorMin)} - ${x(f.int.pitchMax)})\\right] = ${sm.ANut.toFixed(3)}\\ \\text{in}^2`}
      />
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Bolt thread: τ = {ksi(sm.tauBolt)} ksi vs 0.577·{bm.Sy} = {(0.577 * bm.Sy).toFixed(1)} ksi →{' '}
          {(sm.utilBolt * 100).toFixed(0)} %
        </li>
        <li>
          Nut thread: τ = {ksi(sm.tauNut)} ksi vs 0.577·{nm.Sy} = {(0.577 * nm.Sy).toFixed(1)} ksi →{' '}
          {(sm.utilNut * 100).toFixed(0)} %
        </li>
        <li>
          Ultimate stripping {kip(Math.min(sm.FuBolt, sm.FuNut))} kip &gt; bolt breaking load {kip(r.Fu)} kip, and
          L<sub>E,req</sub> = {x(r.LEreq)} in &lt; L<sub>E</sub> — the bolt breaks before the threads strip.
        </li>
      </ul>

      <h4 className="font-medium text-slate-900 dark:text-slate-100">3. Elongation with the nut fixed</h4>
      <p>
        Bolt length {x(lens.L, 2)} in, thread length {x(lens.LT, 2)} in → plain shank L<sub>s</sub> ={' '}
        {x(lens.Ls, 3)} in, free thread L<sub>t</sub> = {x(lens.Lt, 3)} in.
      </p>
      <Formula
        tex={`\\delta = \\tfrac{${F}}{29\\,000\\,000}\\left(\\tfrac{${x(lens.Ls, 3)}}{${r.Ab.toFixed(4)}} + \\tfrac{${x(lens.Lt, 3)}}{${r.As.toFixed(4)}} + \\tfrac{${x(lens.LE, 3)}}{${r.As.toFixed(4)}}\\right) = ${r.dTotal.toFixed(5)}\\ \\text{in} = ${(r.dTotal * 25.4).toFixed(3)}\\ \\text{mm}`}
      />

      <h4 className="font-medium text-slate-900 dark:text-slate-100">4. Flank interference</h4>
      <p>
        ε = {(r.epsT * 1e6).toFixed(0)} µε, so the engaged bolt thread grows by ε·L<sub>E</sub> ={' '}
        {x(mm.growth, 5)} in.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          MMC/MMC: play a = {x(mm.a, 5)} in, Poisson gain p = {x(mm.p, 5)} in → back-flank gap at the last
          thread = {x(mm.gapEnd, 5)} in → <b>{mm.gapEnd < 0 ? 'interference' : 'no interference'}</b>. Onset at
          F<sub>int</sub> = {kip(mm.Fint)} kip ({((mm.Fint / r.Fy) * 100).toFixed(0)} % of F<sub>y</sub>).
        </li>
        <li>
          LMC/LMC: a = {x(lm.a, 5)} in → gap {x(lm.gapEnd, 5)} in, onset at {kip(lm.Fint)} kip — above the yield
          load, so it never occurs in the elastic range.
        </li>
      </ul>
      <blockquote className="border-l-2 border-accent-400 pl-3 text-slate-600 dark:text-slate-400 italic">
        In the Calculator tab set the load to {kN(F)} kN, choose “MMC pair”, press “Apply load in 3D” and then
        “Thread detail”. The magenta fill at the far end of the nut is the interference.
      </blockquote>

      <h3 className="pt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
        Example 3 — nut oversize at 90 % of the yield load ({kip(F3)} kip, {kN(F3)} kN)
      </h3>
      <p>
        Same joint, MMC bolt in MMC nut. ε = {(r3.epsT * 1e6).toFixed(0)} µε, so the pitch grows by{' '}
        {x(r3.fit.MMC.growth, 5)} in over L<sub>E</sub>. The axial play a = {x(r3.fit.MMC.a, 5)} in and the Poisson gain
        p = {x(r3.fit.MMC.p, 5)} in are not enough: the back-flank gap is {x(r3.fit.MMC.gapEnd, 5)} in, i.e.
        interference.
      </p>
      <Formula
        tex={`\\Delta_{req} = 1.732\\cdot ${x(-r3.fit.MMC.gapEnd, 5)} = ${x(req3.exact, 5)}\\ \\text{in} \\;\\rightarrow\\; ${x(req3.rounded, 3)}\\ \\text{in}`}
      />
      <p>
        With the nut overtapped by {x(req3.rounded, 3)} in (D₂ {x(f.int.pitchMin)} → {x(f3.int.pitchMin)} in, D₁{' '}
        {x(f.int.minorMin)} → {x(f3.int.minorMin)} in):
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          back-flank gap {x(r3o.fit.MMC.gapEnd, 5)} in — no interference; onset moves from {kip(r3.fit.MMC.Fint)} to{' '}
          {kip(r3o.fit.MMC.Fint)} kip
        </li>
        <li>
          LMC/LMC radial engagement {x(f.clearance.engagement.min)} → {x(f3.clearance.engagement.min)} in (
          {((f3.clearance.engagement.min / f.basicEngagement) * 100).toFixed(0)} % of basic)
        </li>
        <li>
          nut-thread shear area {r3.strip.LMC.ANut.toFixed(3)} → {r3o.strip.LMC.ANut.toFixed(3)} in², governing stripping
          utilisation {(gov(r3) * 100).toFixed(0)} → {(gov(r3o) * 100).toFixed(0)} %
        </li>
        <li>
          required engagement {x(r3.LEreq)} → {x(r3o.LEreq)} in (available {x(lens.LE)} in). The largest oversize that
          keeps the bolt failing first is {x(max3)} in, so the acceptable range is {x(req3.rounded, 3)} … {x(max3)} in.
        </li>
      </ul>
      <blockquote className="border-l-2 border-accent-400 pl-3 text-slate-600 dark:text-slate-400 italic">
        In the Calculator tab press “90% F<sub>y</sub>”, choose “MMC pair”, apply the load, then press “Set to required”
        in the Nut oversize panel. The interference markers disappear and the before/after table shows the cost.
      </blockquote>

      <h3 className="pt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
        Example 4 — zinc-coated bolt ({coat.bolt.min}–{coat.bolt.max} µm), nut {coat.nut.min}–{coat.nut.max} µm
      </h3>
      <p>
        Limits apply before coating. At MMC the bolt pitch diameter grows by 4·{coat.bolt.max} µm = {um(4 * coat.bolt.max / 25400)} µm
        and the nut pitch diameter shrinks by 4·{coat.nut.max} µm = {um(4 * coat.nut.max / 25400)} µm:
      </p>
      <Formula
        tex={`c_{min}' = ${x(f.clearance.pitch.min)} - 4\\cdot(${coat.bolt.max} + ${coat.nut.max})\\,\\mu m = ${x(f.clearance.pitch.min)} - ${x(chk4.pdConsumed)} = ${x(s4.clearance.pitch.min)}\\ \\text{in}`}
      />
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Negative: the coated MMC bolt does not enter the coated MMC nut. The back-flank gap without load is{' '}
          {x(r4u.fit.MMC.gapEnd, 5)} in. Minimum oversize to assemble: {x(req4u.exact, 5)} → <b>{x(req4u.rounded, 3)} in</b>.
        </li>
        <li>
          B1.1 2A check: 4·t<sub>b,max</sub> = {x(4 * coat.bolt.max / 25400)} in &gt; es = {x(f.ext.allowance)} in (allowance absorbs
          at most {chk4.boltMaxInAllowance.toFixed(1)} µm), so the nut must be overtapped, as is usual for
          galvanized bolting.
        </li>
        <li>
          Under {kip(F4)} kip (60 % F<sub>y</sub>) the pitch growth adds {x(r4l.fit.MMC.growth, 5)} in. The back-flank gap
          is {x(r4l.fit.MMC.gapEnd, 5)} in, so the required oversize rises to {x(req4l.exact, 5)} → <b>{x(req4l.rounded, 3)} in</b>.
          With it the gap is {x(r4o.fit.MMC.gapEnd, 5)} in.
        </li>
        <li>
          The coating carries no load: A<sub>s</sub>, the stripping areas and L<sub>E,req</sub> are the base-metal
          values ({r4l.As.toFixed(4)} in², {r4l.strip.LMC.ABolt.toFixed(3)} / {r4l.strip.LMC.ANut.toFixed(3)} in²,{' '}
          {x(r4l.LEreq)} in). With the {x(req4l.rounded, 3)} in overtap the required engagement is {x(r4o.LEreq)} in
          (available {x(lens.LE)} in).
        </li>
      </ul>
    </div>
  );
}
