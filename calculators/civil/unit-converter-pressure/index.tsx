import type { CalcModule } from '@/lib/types';
import { StubCalculator } from '@/components/StubCalculator';
import { Formula } from '@/components/Formula';

const description = 'Convert pressure between Pa, kPa, MPa, bar, and atm.';

function Calculator() {
  return <StubCalculator description={description} />;
}

function Theory() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>Conversion factors (SI base unit: pascal):</p>
      <Formula tex="1\,\text{MPa} = 10^{3}\,\text{kPa} = 10^{6}\,\text{Pa}" />
      <Formula tex="1\,\text{bar} = 10^{5}\,\text{Pa} = 0.1\,\text{MPa}" />
      <Formula tex="1\,\text{atm} \approx 101\,325\,\text{Pa} \approx 1.01325\,\text{bar}" />
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
    slug: 'unit-converter-pressure',
    name: 'Unit converter — Pressure',
    category: 'civil',
    description,
    status: 'wip',
    tags: ['units', 'conversion', 'pressure'],
  },
  Calculator,
  Theory,
  Examples,
};

export default mod;
