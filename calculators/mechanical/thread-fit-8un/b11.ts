/**
 * ASME B1.1 — Unified Inch Screw Threads (UN and UNR thread form).
 *
 * Limits of size for external threads class 2A (bolt) and internal threads
 * class 2B (nut), computed from the tolerance formulas of the standard.
 * All values in inches unless noted otherwise.
 *
 *   Basic profile         H  = 0.866025 P
 *   Basic pitch diameter  E  = D − 0.649519 P
 *   Basic minor diameter  D1 = D − 1.082532 P          (internal thread)
 *
 *   Pitch-diameter tolerance, class 2A
 *       Td2 = 0.0015·∛D + 0.0015·√LE + 0.015·∛P²       LE = D (standard tables)
 *   Allowance (2A)               es  = 0.300 · Td2
 *   Pitch-diameter tol. (2B)     TD2 = 1.300 · Td2
 *   Major-diameter tol. (2A)     Td  = 0.060 · ∛P²
 *   Minor-diameter tol. (2B)     TD1 = 0.25 P − 0.40 P²   (finer than 4 tpi)
 *                                TD1 = 0.15 P             (4 tpi and coarser)
 *
 * Tolerances/allowance are rounded to 4 decimals before being applied to the
 * basic sizes (same procedure as the B1.1 tables). Internal minor diameters of
 * classes 1B/2B are published to 3 decimals.
 */

export const TAN30 = Math.tan(Math.PI / 6);
export const IN_TO_MM = 25.4;

/** Round half-up with a guard against binary floating point (e.g. 87.7499999 → 88). */
export function roundTo(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f + (x >= 0 ? 1e-7 : -1e-7)) / f;
}

export interface ThreadSize {
  /** Nominal size label, e.g. "1-1/8" */
  label: string;
  /** Basic major diameter D [in] */
  D: number;
  /** Series designation of the 8-tpi thread at this size */
  series: 'UNC' | 'UN';
}

export function fractionLabel(D: number): string {
  const whole = Math.floor(D + 1e-9);
  const frac = D - whole;
  if (frac < 1e-9) return `${whole}`;
  for (const den of [2, 4, 8, 16, 32, 64]) {
    const num = Math.round(frac * den);
    if (Math.abs(num / den - frac) < 1e-9) {
      return whole ? `${whole}-${num}/${den}` : `${num}/${den}`;
    }
  }
  return D.toFixed(4);
}

/** 8-thread series (ASME B1.1): 1 in (= 1-8 UNC) to 6 in. */
export const SIZES_8UN: ThreadSize[] = [
  1, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25,
  4.5, 4.75, 5, 5.25, 5.5, 5.75, 6,
].map((D) => ({ D, label: fractionLabel(D), series: D === 1 ? 'UNC' : 'UN' }));

export interface ExternalLimits {
  /** Allowance es (applied to 2A only) */
  allowance: number;
  majorMax: number;
  majorMin: number;
  majorTol: number;
  pitchMax: number;
  pitchMin: number;
  pitchTol: number;
  /** Max minor diameter for UNR rounded root — reference value in B1.1 tables. */
  minorMaxUNR: number;
  /** Minor diameter at least material (d2 min − 0.57735 P) — derived, not toleranced by B1.1. */
  minorMinRef: number;
}

export interface InternalLimits {
  minorMin: number;
  minorMax: number;
  minorTol: number;
  pitchMin: number;
  pitchMax: number;
  pitchTol: number;
  majorMin: number;
  /** Major diameter at least material (D2 max + 0.649519 P) — derived, not toleranced by B1.1. */
  majorMaxRef: number;
}

export interface Range {
  min: number;
  max: number;
}

export interface ThreadFit {
  size: ThreadSize;
  tpi: number;
  designationExt: string;
  designationInt: string;
  /** Basic major diameter */
  D: number;
  /** Pitch */
  P: number;
  /** Height of fundamental triangle */
  H: number;
  /** Basic pitch diameter (unrounded) */
  E: number;
  /** Basic minor diameter of internal thread (unrounded) */
  D1: number;
  /** Length of engagement used for the tolerance formula */
  LE: number;
  /** Unrounded class 2A pitch-diameter tolerance from the formula */
  td2Raw: number;
  /** Basic thread height of engagement 5H/8 (radial) */
  basicEngagement: number;
  ext: ExternalLimits;
  int: InternalLimits;
  /** Diametral oversize applied to the whole nut thread form (0 = standard 2B) */
  nutOversize: number;
  clearance: Clearance;
}

export interface Clearance {
  major: Range;
  pitch: Range;
  minor: Range;
  /** Total axial play (backlash) along the axis, flanks centred: ΔE·tan 30° */
  axialPlay: Range;
  /** Radial depth of thread engagement (bolt major vs nut minor) */
  engagement: Range;
}

export function clearanceOf(ext: ExternalLimits, int: InternalLimits): Clearance {
  const r4 = (x: number) => roundTo(x, 4);
  const pitch = { min: r4(int.pitchMin - ext.pitchMax), max: r4(int.pitchMax - ext.pitchMin) };
  return {
    major: { min: r4(int.majorMin - ext.majorMax), max: r4(int.majorMaxRef - ext.majorMin) },
    pitch,
    minor: { min: r4(int.minorMin - ext.minorMaxUNR), max: r4(int.minorMax - ext.minorMinRef) },
    axialPlay: { min: pitch.min * TAN30, max: pitch.max * TAN30 },
    engagement: {
      min: (ext.majorMin - int.minorMax) / 2,
      max: (ext.majorMax - int.minorMin) / 2,
    },
  };
}

export function designation(size: ThreadSize, tpi: number, cls: string): string {
  return `${size.label}-${tpi}${size.series}-${cls}`;
}

export function computeFit(size: ThreadSize, tpi = 8): ThreadFit {
  const D = size.D;
  const P = 1 / tpi;
  const H = 0.866025 * P;
  const E = D - 0.649519 * P;
  const D1 = D - 1.082532 * P;
  const LE = D;

  const p23 = Math.cbrt(P * P);
  const td2Raw = 0.0015 * Math.cbrt(D) + 0.0015 * Math.sqrt(LE) + 0.015 * p23;

  const es = roundTo(0.3 * td2Raw, 4);
  const Td2 = roundTo(td2Raw, 4);
  const TD2 = roundTo(1.3 * td2Raw, 4);
  const Td = roundTo(0.06 * p23, 4);
  const TD1 = roundTo(tpi > 4 ? 0.25 * P - 0.4 * P * P : 0.15 * P, 4);

  const E4 = roundTo(E, 4);

  const pitchMax = roundTo(E4 - es, 4);
  const pitchMin = roundTo(pitchMax - Td2, 4);
  const majorMax = roundTo(D - es, 4);
  const majorMin = roundTo(majorMax - Td, 4);
  const ext: ExternalLimits = {
    allowance: es,
    majorMax,
    majorMin,
    majorTol: Td,
    pitchMax,
    pitchMin,
    pitchTol: Td2,
    minorMaxUNR: roundTo(pitchMax - 0.57735 * P, 4),
    minorMinRef: roundTo(pitchMin - 0.57735 * P, 4),
  };

  const minorMin = roundTo(D1, 3);
  const minorMax = roundTo(D1 + TD1, 3);
  const intPitchMax = roundTo(E4 + TD2, 4);
  const int: InternalLimits = {
    minorMin,
    minorMax,
    minorTol: TD1,
    pitchMin: E4,
    pitchMax: intPitchMax,
    pitchTol: TD2,
    majorMin: D,
    majorMaxRef: roundTo(intPitchMax + 0.649519 * P, 4),
  };

  return {
    size,
    tpi,
    designationExt: designation(size, tpi, '2A'),
    designationInt: designation(size, tpi, '2B'),
    D,
    P,
    H,
    E,
    D1,
    LE,
    td2Raw,
    basicEngagement: (5 / 8) * H,
    ext,
    int,
    nutOversize: 0,
    clearance: clearanceOf(ext, int),
  };
}

/**
 * Nut tapped oversize: the whole internal thread form (minor, pitch and major
 * diameter limits) is enlarged by the diametral amount `delta`, as for
 * overtapped (e.g. galvanized) nuts. The result is no longer a gauge-conforming
 * class 2B thread. Applied to a standard fit (nutOversize = 0).
 */
export function applyNutOversize(fit: ThreadFit, delta: number): ThreadFit {
  const base = fit.nutOversize ? fit.nutOversize : 0;
  const d = delta - base;
  if (Math.abs(delta) < 1e-12 && base === 0) return fit;
  const r4 = (x: number) => roundTo(x, 4);
  const i = fit.int;
  const int: InternalLimits = {
    ...i,
    minorMin: r4(i.minorMin + d),
    minorMax: r4(i.minorMax + d),
    pitchMin: r4(i.pitchMin + d),
    pitchMax: r4(i.pitchMax + d),
    majorMin: r4(i.majorMin + d),
    majorMaxRef: r4(i.majorMaxRef + d),
  };
  return {
    ...fit,
    int,
    nutOversize: delta,
    designationInt: delta > 0 ? `${designation(fit.size, fit.tpi, '2B')} oversize +${delta.toFixed(4)}` : designation(fit.size, fit.tpi, '2B'),
    clearance: clearanceOf(fit.ext, int),
  };
}

export function fmtIn(x: number, dp = 4): string {
  if (!Number.isFinite(x)) return '—';
  return x.toFixed(dp);
}

export function fmtMm(xIn: number, dp = 3): string {
  if (!Number.isFinite(xIn)) return '—';
  return (xIn * IN_TO_MM).toFixed(dp);
}
