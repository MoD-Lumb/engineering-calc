import type { CalcModule } from '@/lib/types';
import { StubCalculator } from '@/components/StubCalculator';
import { Formula } from '@/components/Formula';

const description = 'Concrete volume from element dimensions for slabs, footings, and walls.';

function Calculator() {
  return <StubCalculator description={description} />;
}

function Theory() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Volume of a rectangular prismatic element:</p>
      <Formula tex="V = L \cdot W \cdot H" />
      <div>
        <h4 className="font-medium mb-1">Variables</h4>
        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
          <li>V — concrete volume [m³]</li>
          <li>L — length [m]</li>
          <li>W — width [m]</li>
          <li>H — thickness / height [m]</li>
        </ul>
      </div>
      <p className="text-slate-500 dark:text-slate-400">
        Add a waste allowance (typically 5–10%) when ordering ready-mix concrete.
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
    slug: 'concrete-volume',
    name: 'Concrete volume',
    category: 'civil',
    description,
    status: 'wip',
    tags: ['concrete', 'volume', 'quantity'],
  },
  Calculator,
  Theory,
  Examples,
};

export default mod;
