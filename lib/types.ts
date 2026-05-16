import type { ComponentType } from 'react';

export type CalcStatus = 'live' | 'wip';

export type CategorySlug = 'mechanical' | 'civil';

export interface CalcMeta {
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  status: CalcStatus;
  tags?: string[];
}

export interface CalcModule {
  meta: CalcMeta;
  Calculator: ComponentType;
  Theory: ComponentType;
  Examples: ComponentType;
}

export interface Category {
  slug: CategorySlug;
  name: string;
  description: string;
}
