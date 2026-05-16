import type { CalcModule } from '@/lib/types';
import { StubCalculator } from '@/components/StubCalculator';
import { Formula } from '@/components/Formula';

const description =
  'Maximum deflection of a simply supported beam loaded by a central point load.';

function Calculator() {
  return <StubCalculator description={description} />;
}

function Theory() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Maximum mid-span deflection for a centrally loaded, simply supported beam:</p>
      <Formula tex="\delta_{max} = \dfrac{F\,L^{3}}{48\,E\,I}" />
      <div>
        <h4 className="font-medium mb-1">Variables</h4>
        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
          <li>δ_max — maximum deflection [mm]</li>
          <li>F — point load at mid-span [N]</li>
          <li>L — span between supports [mm]</li>
          <li>E — modulus of elasticity [MPa]</li>
          <li>I — second moment of area [mm⁴]</li>
        </ul>
      </div>
      <p className="text-slate-500 dark:text-slate-400">
        Assumes linear-elastic material, small deflections, and pin/roller supports.
      </p>
    </div>
  );
}

function Examples() {
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">Worked examples coming soon.</p>
  );
}

const mod: CalcModule = {
  meta: {
    slug: 'beam-deflection-simple',
    name: 'Beam deflection (simple, point load)',
    category: 'mechanical',
    description,
    status: 'wip',
    tags: ['beam', 'deflection', 'bending'],
  },
  Calculator,
  Theory,
  Examples,
};

export default mod;
