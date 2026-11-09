import type { CalcModule } from '@/lib/types';
import Calculator from './Calculator';
import Theory from './theory.mdx';
import Examples from './Examples';

const mod: CalcModule = {
  meta: {
    slug: 'thread-fit-8un',
    name: '8UN bolt & nut fit 2A/2B — 3D',
    category: 'mechanical',
    description:
      'ASME B1.1 8-thread series: 3D bolt (2A) and nut (2B) with section, exploded and isolated views, MMC/LMC tolerance zones and clearance.',
    status: 'live',
    tags: ['thread', 'bolt', 'nut', '8UN', 'ASME B1.1', 'tolerance', 'fastener', 'clearance', '3D'],
  },
  Calculator,
  Theory,
  Examples,
};

export default mod;
