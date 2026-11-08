import type { ComponentType } from 'react';

export type CalcStatus = 'live' | 'wip';

export type CategorySlug = 'mechanical' | 'civil' | 'process';

export interface CalcMeta {
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  status: CalcStatus;
  tags?: string[];
}

export type CalcTabKey = 'calculator' | 'theory' | 'examples';

export interface CalcModule {
  meta: CalcMeta;
  Calculator: ComponentType;
  Theory: ComponentType;
  Examples: ComponentType;
  /** Optional custom tab titles, e.g. for explainer pages that are not calculators. */
  tabLabels?: Partial<Record<CalcTabKey, string>>;
}

export interface Category {
  slug: CategorySlug;
  name: string;
  description: string;
}
