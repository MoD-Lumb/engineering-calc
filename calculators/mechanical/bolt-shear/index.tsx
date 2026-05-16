import type { CalcModule } from '@/lib/types';
import { StubCalculator } from '@/components/StubCalculator';
import { Formula } from '@/components/Formula';

const description = 'Shear capacity of a single bolt based on the ultimate shear strength.';

function Calculator() {
  return <StubCalculator description={description} />;
}

function Theory() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Shear capacity of a bolt in single shear:</p>
      <Formula tex="V_R = \tau_u \cdot A_s" />
      <div>
        <h4 className="font-medium mb-1">Variables</h4>
        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
          <li>V_R — shear resistance [N]</li>
          <li>τ_u — ultimate shear strength of bolt material [MPa]</li>
          <li>A_s — shear area of the bolt [mm²]</li>
        </ul>
      </div>
      <p className="text-slate-500 dark:text-slate-400">
        For double shear, multiply by 2. Apply the relevant safety factor per applicable standard.
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
    slug: 'bolt-shear',
    name: 'Bolt shear capacity',
    category: 'mechanical',
    description,
    status: 'wip',
    tags: ['bolt', 'shear', 'fastener'],
  },
  Calculator,
  Theory,
  Examples,
};

export default mod;
