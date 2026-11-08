import type { CalcModule } from '@/lib/types';
import { PlantViewerLoader } from './PlantViewerLoader';
import Theory from './theory.mdx';
import Examples from './examples.mdx';

const mod: CalcModule = {
  meta: {
    slug: 'oil-production-plant',
    name: 'Oil production plant (3D)',
    category: 'process',
    description:
      'Interactive 3D model of an onshore oil production plant, from reservoir and wells through separation, treatment and export of oil, gas and water.',
    status: 'live',
    tags: ['oil', 'gas', 'separator', 'process', '3d', 'production', 'explainer'],
  },
  tabLabels: {
    calculator: '3D model',
    theory: 'Process theory',
    examples: 'Worked examples',
  },
  Calculator: PlantViewerLoader,
  Theory,
  Examples,
};

export default mod;
