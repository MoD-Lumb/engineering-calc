export type Config = 'assembled' | 'exploded' | 'bolt' | 'nut';
export type Section = 'none' | 'half' | 'quarter';
export type ViewKind = 'fit' | 'iso' | 'front' | 'detail';

export interface Visibility {
  boltMMC: boolean;
  boltLMC: boolean;
  nutMMC: boolean;
  nutLMC: boolean;
  /** ASME B1.1 basic profile (dashed) on the section plane */
  basic: boolean;
  /** Fill the gap between the visible bolt and nut profiles */
  clearance: boolean;
}

export const DEFAULT_VIS: Visibility = {
  boltMMC: true,
  boltLMC: true,
  nutMMC: true,
  nutLMC: true,
  basic: false,
  clearance: true,
};

/**
 * Colours per condition. `solid` = 3D surface, `fill` = section/profile fill,
 * `line` = outline on the section plane.
 */
export const PALETTE = {
  boltMMC: { solid: '#dc2626', fill: '#ef4444', line: '#7f1d1d' },
  boltLMC: { solid: '#f59e0b', fill: '#fcd34d', line: '#92400e' },
  nutMMC: { solid: '#2563eb', fill: '#3b82f6', line: '#1e3a8a' },
  nutLMC: { solid: '#06b6d4', fill: '#a5f3fc', line: '#155e75' },
  clearance: '#22c55e',
  interference: '#d946ef',
  coating: { light: '#71717a', dark: '#d4d4d8' },
  basic: { light: '#6d28d9', dark: '#c4b5fd' },
  boltSteel: '#c0c6cf',
  nutSteel: '#a3acb8',
} as const;

export type CondKey = 'boltMMC' | 'boltLMC' | 'nutMMC' | 'nutLMC';
