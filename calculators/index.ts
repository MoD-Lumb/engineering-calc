import type { CalcModule } from '@/lib/types';
import axialStress from './mechanical/axial-stress';
import beamDeflection from './mechanical/beam-deflection-simple';
import boltShear from './mechanical/bolt-shear';
import concreteVolume from './civil/concrete-volume';
import unitLength from './civil/unit-converter-length';
import unitPressure from './civil/unit-converter-pressure';

export const calculators: CalcModule[] = [
  axialStress,
  beamDeflection,
  boltShear,
  concreteVolume,
  unitLength,
  unitPressure,
];

export function findCalculator(category: string, slug: string): CalcModule | undefined {
  return calculators.find((c) => c.meta.category === category && c.meta.slug === slug);
}

export function calculatorsByCategory(category: string): CalcModule[] {
  return calculators.filter((c) => c.meta.category === category);
}
