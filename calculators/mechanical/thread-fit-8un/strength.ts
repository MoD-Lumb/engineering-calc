/**
 * Strength of the 8UN bolt / nut joint under a static tensile working load.
 *
 * Units inside this module: inch, lbf, psi (material data in ksi).
 *
 *  1. Bolt tension: ASME B1.1 tensile stress area As, σ = F/As vs. yield Sy.
 *  2. Thread stripping: B1.1 / FED-STD-H28 shear areas of external and
 *     internal threads, τ = F/A vs. shear yield 0.577·Sy.
 *  3. Elongation with the nut fixed: δ = F/E·(Ls/Ab + Lt/As + LE/As).
 *  4. Flank interference ("full-load stretch" model): the engaged bolt
 *     thread is strained by ε = F/(E·As) over the whole engagement, the
 *     first engaged thread bears on its loaded flank, and the pitch growth
 *     ε·LE is compared with the axial flank play of the pair.
 */
import { TAN30, type ThreadFit } from './b11';
import type { Cond } from './geometry';

/* ------------------------------------------------------------------------ */
/* Materials                                                                 */
/* ------------------------------------------------------------------------ */

export interface StrengthBand {
  /** Upper limit of the diameter band [in] (inclusive) */
  maxD: number;
  /** Minimum tensile strength [ksi] */
  Su: number;
  /** Minimum yield strength (0.2 % offset) [ksi] */
  Sy: number;
}

export interface BoltGrade {
  id: string;
  name: string;
  bands: StrengthBand[];
  /** Young's modulus [ksi] */
  E: number;
  /** Recommended nut grade id */
  nut: string;
  note: string;
}

export interface NutGrade {
  id: string;
  name: string;
  Su: number;
  Sy: number;
  note: string;
}

export const BOLT_GRADES: BoltGrade[] = [
  {
    id: 'B7',
    name: 'ASTM A193 B7',
    bands: [
      { maxD: 2.5, Su: 125, Sy: 105 },
      { maxD: 4, Su: 115, Sy: 95 },
      { maxD: 7, Su: 100, Sy: 75 },
    ],
    E: 29000,
    nut: '2H',
    note: 'Cr-Mo steel, quenched & tempered',
  },
  {
    id: 'B16',
    name: 'ASTM A193 B16',
    bands: [
      { maxD: 2.5, Su: 125, Sy: 105 },
      { maxD: 4, Su: 110, Sy: 95 },
      { maxD: 8, Su: 100, Sy: 85 },
    ],
    E: 29000,
    nut: '2H',
    note: 'Cr-Mo-V steel, quenched & tempered',
  },
  {
    id: 'L7',
    name: 'ASTM A320 L7',
    bands: [{ maxD: 2.5, Su: 125, Sy: 105 }],
    E: 29000,
    nut: '7',
    note: 'Low-temperature Cr-Mo steel',
  },
  {
    id: 'B8-2',
    name: 'ASTM A193 B8 Class 2',
    bands: [
      { maxD: 0.75, Su: 125, Sy: 100 },
      { maxD: 1, Su: 115, Sy: 80 },
      { maxD: 1.25, Su: 105, Sy: 65 },
      { maxD: 1.5, Su: 100, Sy: 50 },
    ],
    E: 28000,
    nut: '8',
    note: '304 stainless, strain hardened',
  },
  {
    id: 'G5',
    name: 'SAE J429 Grade 5',
    bands: [
      { maxD: 1, Su: 120, Sy: 92 },
      { maxD: 1.5, Su: 105, Sy: 81 },
    ],
    E: 29000,
    nut: 'J995-5',
    note: 'Medium carbon steel, quenched & tempered',
  },
  {
    id: 'G8',
    name: 'SAE J429 Grade 8',
    bands: [{ maxD: 1.5, Su: 150, Sy: 130 }],
    E: 29000,
    nut: 'J995-8',
    note: 'Medium carbon alloy steel, quenched & tempered',
  },
];

/**
 * Nut specifications give hardness and proof-load stress, not yield / tensile
 * strength of the nut material, so these are estimates — replace them with
 * certified values where available.
 */
export const NUT_GRADES: NutGrade[] = [
  {
    id: '2H',
    name: 'ASTM A194 2H',
    Su: 120,
    Sy: 95,
    note: 'Estimate: Su from min. hardness 248 HB (ASTM A370 conversion), Sy ≈ 0.8·Su',
  },
  {
    id: '7',
    name: 'ASTM A194 Grade 7',
    Su: 120,
    Sy: 95,
    note: 'Estimate: Su from min. hardness 248 HB (ASTM A370 conversion), Sy ≈ 0.8·Su',
  },
  {
    id: '8',
    name: 'ASTM A194 Grade 8',
    Su: 75,
    Sy: 30,
    note: 'Estimate: annealed 304 stainless minimum properties',
  },
  {
    id: 'J995-5',
    name: 'SAE J995 Grade 5',
    Su: 105,
    Sy: 81,
    note: 'Estimate: taken equal to the Grade 5 bolt material above 1 in',
  },
  {
    id: 'J995-8',
    name: 'SAE J995 Grade 8',
    Su: 150,
    Sy: 130,
    note: 'Estimate: taken equal to the Grade 8 bolt material',
  },
];

export interface BoltProps {
  Su: number;
  Sy: number;
  E: number;
  nu: number;
  /** false when D is outside the diameter range of the specification */
  covered: boolean;
}

export function boltGradeProps(grade: BoltGrade, D: number): BoltProps {
  const band = grade.bands.find((b) => D <= b.maxD + 1e-9);
  const last = grade.bands[grade.bands.length - 1];
  const b = band ?? last;
  return { Su: b.Su, Sy: b.Sy, E: grade.E, nu: 0.3, covered: !!band };
}

/* ------------------------------------------------------------------------ */
/* Lengths (heavy hex bolt per ASME B18.2.1 proportions)                     */
/* ------------------------------------------------------------------------ */

export function heavyHexNutThickness(D: number): number {
  return D - (D <= 1.125 ? 1 / 64 : D <= 2 ? 1 / 32 : 3 / 64);
}

export interface BoltLengths {
  grip: number;
  nutH: number;
  /** Nut bearing face (x = grip) and outer face */
  nutA: number;
  nutB: number;
  /** Bolt length under head */
  L: number;
  /** Thread length per B18.2.1 */
  LT: number;
  /** End of the plain shank (start of thread) */
  xTs: number;
  /** Engaged thread range (nut faces minus 120° countersinks to D + 1.2 P) */
  eA: number;
  eB: number;
  LE: number;
  /** Plain shank length in the grip */
  Ls: number;
  /** Free threaded length from shank end to the first engaged thread */
  Lt: number;
}

export function boltLengths(D: number, P: number, grip: number): BoltLengths {
  const nutH = heavyHexNutThickness(D);
  const nutA = grip;
  const nutB = grip + nutH;
  const L = Math.ceil((nutB + Math.max(3 * P, 0.3 * D)) * 4 - 1e-9) / 4;
  const LT = 2 * D + (L <= 6 ? 0.25 : 0.5);
  const xTs = Math.max(0, Math.min(L - LT, nutA - 2 * P));
  const cs = (0.6 * P) / Math.sqrt(3);
  const eA = nutA + cs;
  const eB = nutB - cs;
  return { grip, nutH, nutA, nutB, L, LT, xTs, eA, eB, LE: eB - eA, Ls: xTs, Lt: eA - xTs };
}

export function defaultGrip(D: number): number {
  return Math.round(2 * D * 8) / 8;
}

/* ------------------------------------------------------------------------ */
/* Strength                                                                  */
/* ------------------------------------------------------------------------ */

export interface PairDims {
  /** bolt major, bolt pitch diameter */
  d: number;
  d2: number;
  /** nut minor, nut pitch diameter */
  D1: number;
  D2: number;
}

export function pairDims(fit: ThreadFit, bolt: Cond, nut: Cond): PairDims {
  return {
    d: bolt === 'MMC' ? fit.ext.majorMax : fit.ext.majorMin,
    d2: bolt === 'MMC' ? fit.ext.pitchMax : fit.ext.pitchMin,
    D1: nut === 'MMC' ? fit.int.minorMin : fit.int.minorMax,
    D2: nut === 'MMC' ? fit.int.pitchMin : fit.int.pitchMax,
  };
}

export interface StrippingResult {
  /** Shear area per inch of engagement, bolt (external) thread [in²/in] */
  aBolt: number;
  aNut: number;
  /** Shear areas over LE [in²] */
  ABolt: number;
  ANut: number;
  /** Stripping shear stress at the working load [psi] */
  tauBolt: number;
  tauNut: number;
  /** τ / (0.577·Sy) */
  utilBolt: number;
  utilNut: number;
  /** Load at which shear yield is reached [lbf] */
  FyBolt: number;
  FyNut: number;
  /** Ultimate stripping load 0.6·Su·A [lbf] */
  FuBolt: number;
  FuNut: number;
}

export interface FlankFit {
  /** Axial flank play (D2 − d2)·tan 30° [in] */
  a: number;
  /** Axial play gained by Poisson contraction of the bolt ν·ε·d2·tan 30° [in] */
  p: number;
  /** Pitch growth over the engaged length ε·LE [in] */
  growth: number;
  /** Back-flank gap at the far end of the engagement [in] (negative = interference) */
  gapEnd: number;
  /** Interference depth (axial) [in] */
  interference: number;
  /** Load at which interference starts [lbf] (Infinity if never) */
  Fint: number;
}

export interface StrengthResult {
  F: number;
  As: number;
  AsBasic: number;
  AsHigh: number;
  highStrength: boolean;
  Ab: number;
  /** Tensile stress [psi] */
  sigma: number;
  Fy: number;
  Fu: number;
  utilTension: number;
  strip: Record<Cond, StrippingResult>;
  /** Minimum LE for the bolt to break before the threads strip (B1.1 App. B, LMC) */
  LEreq: number;
  /** Bolt strain in the threaded part and in the plain shank */
  epsT: number;
  epsB: number;
  dShank: number;
  dThread: number;
  dEngaged: number;
  dTotal: number;
  fit: Record<Cond, FlankFit>;
}

const SHEAR_Y = 0.577;
const SHEAR_U = 0.6;

function strippingPerLength(fit: ThreadFit, pd: PairDims) {
  const n = fit.tpi;
  return {
    aBolt: Math.PI * n * pd.D1 * (1 / (2 * n) + TAN30 * (pd.d2 - pd.D1)),
    aNut: Math.PI * n * pd.d * (1 / (2 * n) + TAN30 * (pd.d - pd.D2)),
  };
}

export function flankFit(
  fit: ThreadFit,
  bolt: Cond,
  nut: Cond,
  F: number,
  As: number,
  E: number,
  nu: number,
  LE: number
): FlankFit {
  const pd = pairDims(fit, bolt, nut);
  const Epsi = E * 1000;
  const eps = F / (Epsi * As);
  const a = (pd.D2 - pd.d2) * TAN30;
  const p = nu * eps * pd.d2 * TAN30;
  const growth = eps * LE;
  const gapEnd = a + p - growth;
  const denom = LE - nu * pd.d2 * TAN30;
  return {
    a,
    p,
    growth,
    gapEnd,
    interference: Math.max(0, -gapEnd),
    Fint: denom > 0 ? (a * Epsi * As) / denom : Infinity,
  };
}

export function computeStrength(
  fit: ThreadFit,
  lens: BoltLengths,
  F: number,
  bolt: BoltProps,
  nut: { Su: number; Sy: number }
): StrengthResult {
  const { D, tpi: n } = fit;
  const AsBasic = 0.7854 * (D - 0.9743 / n) ** 2;
  const AsHigh = Math.PI * (fit.ext.pitchMin / 2 - 0.16238 / n) ** 2;
  const highStrength = bolt.Su > 100;
  const As = highStrength ? AsHigh : AsBasic;
  const Ab = (Math.PI * D * D) / 4;
  const sigma = F / As;
  const Sy = bolt.Sy * 1000;
  const Su = bolt.Su * 1000;
  const SyN = nut.Sy * 1000;
  const SuN = nut.Su * 1000;

  const strip = {} as Record<Cond, StrippingResult>;
  for (const c of ['MMC', 'LMC'] as Cond[]) {
    const { aBolt, aNut } = strippingPerLength(fit, pairDims(fit, c, c));
    const ABolt = aBolt * lens.LE;
    const ANut = aNut * lens.LE;
    const tauBolt = F / ABolt;
    const tauNut = F / ANut;
    strip[c] = {
      aBolt,
      aNut,
      ABolt,
      ANut,
      tauBolt,
      tauNut,
      utilBolt: tauBolt / (SHEAR_Y * Sy),
      utilNut: tauNut / (SHEAR_Y * SyN),
      FyBolt: SHEAR_Y * Sy * ABolt,
      FyNut: SHEAR_Y * SyN * ANut,
      FuBolt: SHEAR_U * Su * ABolt,
      FuNut: SHEAR_U * SuN * ANut,
    };
  }
  // B1.1 Appendix B: LE = 2·As / (π·Kn,max·[1/2 + 0.57735·n·(Es,min − Kn,max)]),
  // and the same with the strength ratio when the nut material is weaker.
  const lmc = strip.LMC;
  const LEreq = Math.max((2 * As) / lmc.aBolt, (2 * As * Su) / (SuN * lmc.aNut));

  const Epsi = bolt.E * 1000;
  const epsT = F / (Epsi * As);
  const epsB = F / (Epsi * Ab);
  const dShank = epsB * lens.Ls;
  const dThread = epsT * lens.Lt;
  const dEngaged = epsT * lens.LE;

  return {
    F,
    As,
    AsBasic,
    AsHigh,
    highStrength,
    Ab,
    sigma,
    Fy: Sy * As,
    Fu: Su * As,
    utilTension: sigma / Sy,
    strip,
    LEreq,
    epsT,
    epsB,
    dShank,
    dThread,
    dEngaged,
    dTotal: dShank + dThread + dEngaged,
    fit: {
      MMC: flankFit(fit, 'MMC', 'MMC', F, As, bolt.E, bolt.nu, lens.LE),
      LMC: flankFit(fit, 'LMC', 'LMC', F, As, bolt.E, bolt.nu, lens.LE),
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Displacement field of the loaded bolt (drawing units)                     */
/* ------------------------------------------------------------------------ */

/**
 * Axial displacement d(x) and radius factor of the bolt as drawn, with the
 * nut fixed. Inside and beyond the engagement the real values are magnified
 * by k (same factor as the tolerances, so clearance and interference are
 * comparable); the free length between head and nut is magnified by M so the
 * elongation becomes visible.
 *
 *  x ≤ 0          head: rigid
 *  0 … xTs        plain shank, strain εb·M
 *  xTs … eA       free thread, strain εt·M
 *  eA … eB        engaged thread, strain εt·k, first thread bears:
 *                 d(eA) = −k·(a + p)/2
 *  x ≥ eB         rigid
 * Radius: r·(1 − k·ν·ε) (Poisson contraction), faded out over one pitch past eB.
 */
export interface StretchParams {
  xTs: number;
  eA: number;
  eB: number;
  P: number;
  dA: number;
  strainB: number;
  strainT: number;
  strainE: number;
  radB: number;
  radT: number;
}

export const NO_STRETCH: StretchParams = {
  xTs: 0,
  eA: 0,
  eB: 0,
  P: 1,
  dA: 0,
  strainB: 0,
  strainT: 0,
  strainE: 0,
  radB: 0,
  radT: 0,
};

export function stretchParams(
  lens: BoltLengths,
  P: number,
  s: StrengthResult,
  ff: FlankFit,
  nu: number,
  k: number,
  M: number
): StretchParams {
  return {
    xTs: lens.xTs,
    eA: lens.eA,
    eB: lens.eB,
    P,
    dA: (-k * (ff.a + ff.p)) / 2,
    strainB: M * s.epsB,
    strainT: M * s.epsT,
    strainE: k * s.epsT,
    radB: k * nu * s.epsB,
    radT: k * nu * s.epsT,
  };
}

/** Same function as the GLSL in ThreadViewer — keep the two in sync. */
export function stretchDx(sp: StretchParams, x: number): number {
  if (x >= sp.eB) return sp.dA + sp.strainE * (sp.eB - sp.eA);
  if (x >= sp.eA) return sp.dA + sp.strainE * (x - sp.eA);
  if (x >= sp.xTs) return sp.dA - sp.strainT * (sp.eA - x);
  const dTs = sp.dA - sp.strainT * (sp.eA - sp.xTs);
  if (x >= 0) return dTs - sp.strainB * (sp.xTs - x);
  return dTs - sp.strainB * sp.xTs;
}

export function stretchR(sp: StretchParams, x: number): number {
  if (x < 0) return 1;
  if (x < sp.xTs) return 1 - sp.radB;
  if (x <= sp.eB) return 1 - sp.radT;
  const t = Math.min(1, Math.max(0, (x - sp.eB) / sp.P));
  return 1 - sp.radT * (1 - t);
}

/* ------------------------------------------------------------------------ */
/* Units                                                                     */
/* ------------------------------------------------------------------------ */

export const LBF_PER_KN = 224.80894;
export const MPA_PER_KSI = 6.894757;
