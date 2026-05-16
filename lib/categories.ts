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
];

export function categoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
