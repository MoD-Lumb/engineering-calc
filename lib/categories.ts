import type { Category } from './types';

export const categories: Category[] = [
  {
    slug: 'mechanical',
    name: 'Mechanical / Strength of materials',
    description: 'Beams, stresses, fasteners, deflection.',
  },
  {
    slug: 'civil',
    name: 'Civil / Structural / Unit converters',
    description: 'Loads, sections, geometry, conversions.',
  },
  {
    slug: 'process',
    name: 'Process / Oil & Gas',
    description: 'Production facilities, separation, treatment — with 3D explainers.',
  },
];

export function categoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
