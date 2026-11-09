import type { CalcModule } from '@/lib/types';
import { createSpecCalcModule } from '@/lib/spec';
import { SpecGrid } from '@/components/SpecGrid';
import spec from './calc.yaml';
import Theory from './theory.mdx';
import Examples from './examples.mdx';

const mod: CalcModule = createSpecCalcModule(spec, Theory, Examples, SpecGrid);

export default mod;
