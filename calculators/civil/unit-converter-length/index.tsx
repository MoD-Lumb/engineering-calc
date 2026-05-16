import type { CalcModule } from '@/lib/types';
import { StubCalculator } from '@/components/StubCalculator';
import { Formula } from '@/components/Formula';

const description = 'Convert lengths between mm, cm, m, and km.';

function Calculator() {
  return <StubCalculator description={description} />;
}

function Theory() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Conversion factors (SI):</p>
      <Formula tex="1\,\text{m} = 10\,\text{dm} = 100\,\text{cm} = 1000\,\text{mm}" />
      <Formula tex="1\,\text{km} = 1000\,\text{m}" />
      <p className="text-slate-500 dark:text-slate-400">
        The calculator will accept input in any of these units and display equivalents in all of
        them simultaneously.
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
    slug: 'unit-converter-length',
    name: 'Unit converter — Length',
    category: 'civil',
    description,
    status: 'wip',
    tags: ['units', 'conversion', 'length'],
  },
  Calculator,
  Theory,
  Examples,
};

export default mod;
