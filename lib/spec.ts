import { createElement, type ComponentType } from 'react';
import type { CalcMeta, CalcModule, CalcStatus, CategorySlug } from './types';

export interface SpecInputRow {
  id: string;
  label: string;
  input: number;
  unit?: string;
  note?: string;
  min?: number;
  max?: number;
  step?: number;
  highlight?: boolean;
}

export interface SpecFormulaRow {
  id: string;
  label: string;
  formula: string;
  unit?: string;
  note?: string;
  highlight?: boolean;
  digits?: number;
}

export type SpecRow = SpecInputRow | SpecFormulaRow;

export interface CalcSpec {
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  status: CalcStatus;
  tags?: string[];
  rows: SpecRow[];
}

export function isInputRow(row: SpecRow): row is SpecInputRow {
  return 'input' in row;
}

export function isFormulaRow(row: SpecRow): row is SpecFormulaRow {
  return 'formula' in row;
}

function validateSpec(spec: unknown): asserts spec is CalcSpec {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Calc spec must be an object');
  }
  const s = spec as Record<string, unknown>;
  for (const field of ['slug', 'name', 'category', 'description', 'status']) {
    if (typeof s[field] !== 'string') {
      throw new Error(`Calc spec missing required string field: ${field}`);
    }
  }
  if (!Array.isArray(s.rows) || s.rows.length === 0) {
    throw new Error('Calc spec must have a non-empty rows array');
  }
  const seen = new Set<string>();
  for (const row of s.rows as SpecRow[]) {
    if (!row.id || !row.label) {
      throw new Error('Each row must have id and label');
    }
    if (seen.has(row.id)) {
      throw new Error(`Duplicate row id: ${row.id}`);
    }
    seen.add(row.id);
    const hasInput = 'input' in row;
    const hasFormula = 'formula' in row;
    if (hasInput === hasFormula) {
      throw new Error(`Row "${row.id}" must have exactly one of: input, formula`);
    }
  }
}

export function specToMeta(spec: CalcSpec): CalcMeta {
  return {
    slug: spec.slug,
    name: spec.name,
    category: spec.category,
    description: spec.description,
    status: spec.status,
    tags: spec.tags,
  };
}

export function createSpecCalcModule(
  rawSpec: unknown,
  Theory: ComponentType,
  Examples: ComponentType,
  SpecRunner: ComponentType<{ spec: CalcSpec }>
): CalcModule {
  validateSpec(rawSpec);
  const spec = rawSpec;
  const Calculator = () => createElement(SpecRunner, { spec });
  return {
    meta: specToMeta(spec),
    Calculator,
    Theory,
    Examples,
  };
}
