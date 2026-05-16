import type { CalcModule } from '@/lib/types';
import { StubCalculator } from '@/components/StubCalculator';
import { Formula } from '@/components/Formula';

const description = 'Computes normal axial stress from applied force and cross-sectional area.';

function Calculator() {
  return <StubCalculator description={description} />;
}

function Theory() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Normal stress under uniaxial loading:</p>
      <Formula tex="\sigma = \dfrac{F}{A}" />
      <div>
        <h4 className="font-medium mb-1">Variables</h4>
        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
          <li>σ — normal stress [MPa]</li>
          <li>F — axial force [N]</li>
          <li>A — cross-sectional area [mm²]</li>
        </ul>
      </div>
      <p className="text-slate-500 dark:text-slate-400">
        Assumes uniform stress distribution and a prismatic member loaded along its centroidal axis.
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
    slug: 'axial-stress',
    name: 'Axial stress',
    category: 'mechanical',
    description,
    status: 'wip',
    tags: ['stress', 'normal', 'force'],
  },
  Calculator,
  Theory,
  Examples,
};

export default mod;
