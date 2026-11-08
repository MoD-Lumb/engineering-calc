/**
 * Geometry for the 8UN bolt / nut model.
 *
 * Coordinate frame (inches): the thread axis is the world X axis. A point at
 * axial position x, radius r and angle θ (measured from +Y towards +Z) is
 *   (x, r·cos θ, r·sin θ).
 *
 * Threads are right-handed: a thread crest centred at helix phase s = 0 lies at
 *   x = u + P·θ / 2π
 * so it advances along +X when turning by the right-hand rule about +X.
 *
 * The thread surfaces are built on a helical grid (rows of constant helix
 * coordinate u, columns of constant θ), so the profile corners are reproduced
 * exactly. Section caps are computed analytically from the same functions,
 * so they line up with the clipped mesh.
 */
import * as THREE from 'three';
import { TAN30, type ThreadFit } from './b11';

export type Cond = 'MMC' | 'LMC';
export const CONDS: Cond[] = ['MMC', 'LMC'];

const SIN60 = Math.sqrt(3) / 2;
const TAN60 = Math.sqrt(3);
const TWO_PI = Math.PI * 2;

/** Thread diameters (as drawn) for one condition of one part. */
export interface ProfileDims {
  major: number;
  pitch: number;
  minor: number;
}

/** One sample of a periodic thread profile; s ∈ [−P/2, P/2), s = 0 at the bolt crest centre. */
export interface ProfileSample {
  s: number;
  r: number;
  /** A sharp corner — the mesh duplicates this row so shading stays crisp. */
  crease: boolean;
}

/* ------------------------------------------------------------------------ */
/* Profiles                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Drawn diameters: basic size + k × (limit − basic). k = 1 is true scale.
 * The bolt root and the nut root follow the pitch diameter (fixed tool form).
 */
export function visualDims(fit: ThreadFit, k: number) {
  const { D, P, E, D1 } = fit;
  const ex = (basic: number, actual: number) => basic + k * (actual - basic);
  const bolt = (major: number, pitch: number): ProfileDims => {
    const pv = ex(E, pitch);
    return { major: ex(D, major), pitch: pv, minor: pv - 0.57735 * P };
  };
  const nut = (minor: number, pitch: number): ProfileDims => {
    const pv = ex(E, pitch);
    return { minor: ex(D1, minor), pitch: pv, major: pv + 0.649519 * P };
  };
  return {
    bolt: {
      MMC: bolt(fit.ext.majorMax, fit.ext.pitchMax),
      LMC: bolt(fit.ext.majorMin, fit.ext.pitchMin),
    } as Record<Cond, ProfileDims>,
    nut: {
      MMC: nut(fit.int.minorMin, fit.int.pitchMin),
      LMC: nut(fit.int.minorMax, fit.int.pitchMax),
    } as Record<Cond, ProfileDims>,
  };
}

/**
 * External thread (bolt) profile: flat crest at the major diameter, straight
 * 30° flanks through the pitch line (thread thickness P/2 at the pitch
 * diameter) and a UNR rounded root whose bottom is at the minor diameter.
 */
export function boltProfile(d: ProfileDims, P: number, nFlank = 4, nArc = 3): ProfileSample[] {
  const Rp = d.pitch / 2;
  const rV = Rp - P / 4 / TAN30; // sharp-V root
  const Ra = Math.max(d.minor / 2, Math.min(d.major / 2, Rp + P / 4 / TAN30));
  const wc = Math.min(P / 2 - 1e-6, Math.max(0, P / 4 - (Ra - Rp) * TAN30));
  let rho = Math.max(0, d.minor / 2 - rV);
  rho = Math.min(rho, ((P / 2 - wc) / SIN60) * 0.98);
  const rc = rV + 2 * rho;
  const sT = P / 2 - rho * SIN60; // flank / root-arc tangent point
  const flankR = (a: number) => Rp + (P / 4 - a) / TAN30;

  const out: ProfileSample[] = [];
  for (let i = 0; i < nArc; i++) {
    const phi = (Math.PI / 3) * (i / nArc);
    out.push({ s: -P / 2 + rho * Math.sin(phi), r: rc - rho * Math.cos(phi), crease: false });
  }
  for (let i = 0; i < nFlank; i++) {
    const a = sT + (wc - sT) * (i / nFlank);
    out.push({ s: -a, r: flankR(a), crease: false });
  }
  if (wc > 1e-9) {
    out.push({ s: -wc, r: Ra, crease: true });
    out.push({ s: wc, r: Ra, crease: true });
  } else {
    out.push({ s: 0, r: Ra, crease: true });
  }
  for (let i = 1; i <= nFlank; i++) {
    const a = wc + (sT - wc) * (i / nFlank);
    out.push({ s: a, r: flankR(a), crease: false });
  }
  for (let i = nArc - 1; i >= 1; i--) {
    const phi = (Math.PI / 3) * (i / nArc);
    out.push({ s: P / 2 - rho * Math.sin(phi), r: rc - rho * Math.cos(phi), crease: false });
  }
  return out;
}

/**
 * Internal thread (nut) hole profile: flat root at the major diameter
 * (centred on s = 0, where the bolt crest sits), 30° flanks with a space
 * width of P/2 at the pitch diameter, flat crest at the minor diameter.
 */
export function nutProfile(d: ProfileDims, P: number, nFlank = 4): ProfileSample[] {
  const Rp = d.pitch / 2;
  const RM = Math.min(d.major / 2, Rp + P / 4 / TAN30);
  const wr = Math.max(0, P / 4 - (RM - Rp) * TAN30);
  const Rn = Math.min(RM, Math.max(d.minor / 2, Rp - P / 4 / TAN30));
  const wsp = Math.max(wr, Math.min(P / 2, P / 4 - (Rn - Rp) * TAN30));
  const flankR = (a: number) => Rp + (P / 4 - a) / TAN30;
  const crestFlat = wsp < P / 2 - 1e-9;

  const out: ProfileSample[] = [];
  if (crestFlat) out.push({ s: -P / 2, r: Rn, crease: false });
  out.push({ s: -wsp, r: Rn, crease: true });
  for (let i = 1; i < nFlank; i++) {
    const a = wsp + (wr - wsp) * (i / nFlank);
    out.push({ s: -a, r: flankR(a), crease: false });
  }
  if (wr > 1e-9) {
    out.push({ s: -wr, r: RM, crease: true });
    out.push({ s: wr, r: RM, crease: true });
  } else {
    out.push({ s: 0, r: RM, crease: true });
  }
  for (let i = 1; i < nFlank; i++) {
    const a = wr + (wsp - wr) * (i / nFlank);
    out.push({ s: a, r: flankR(a), crease: false });
  }
  if (crestFlat) out.push({ s: wsp, r: Rn, crease: true });
  return out;
}

/** ASME B1.1 basic profile: P/8 flat at D, P/4 flat at D1, 60° flanks. */
export function basicProfile(fit: ThreadFit): ProfileSample[] {
  const { D, D1, P } = fit;
  return [
    { s: -P / 2, r: D1 / 2, crease: false },
    { s: -(3 * P) / 8, r: D1 / 2, crease: true },
    { s: -P / 16, r: D / 2, crease: true },
    { s: P / 16, r: D / 2, crease: true },
    { s: (3 * P) / 8, r: D1 / 2, crease: true },
  ];
}

/** Linear interpolation of a periodic profile at any helix phase s. */
export function evalProfile(samples: ProfileSample[], P: number, s: number): number {
  const t = s - Math.floor((s + P / 2) / P) * P; // → [−P/2, P/2)
  const n = samples.length;
  let lo = 0;
  let hi = n - 1;
  if (t < samples[0].s) {
    // between the last sample (shifted back one period) and the first
    const a = samples[n - 1];
    const b = samples[0];
    const sa = a.s - P;
    return a.r + ((b.r - a.r) * (t - sa)) / (b.s - sa || 1);
  }
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].s <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = samples[lo];
  const b = lo + 1 < n ? samples[lo + 1] : { s: samples[0].s + P, r: samples[0].r };
  const span = b.s - a.s;
  return span > 1e-12 ? a.r + ((b.r - a.r) * (t - a.s)) / span : a.r;
}

/** Phase of the helix at axial position x and angle θ. */
export function phaseAt(x: number, theta: number, P: number): number {
  return x - (P * theta) / TWO_PI;
}

/* ------------------------------------------------------------------------ */
/* Layout                                                                    */
/* ------------------------------------------------------------------------ */

export interface Layout {
  D: number;
  P: number;
  /** Width across flats (heavy hex ≈ 1.5 D + 1/8) */
  F: number;
  /** Chamfer circle radius on hex faces */
  rCh: number;
  headH: number;
  /** End of the plain shank / start of thread runout */
  xTs: number;
  /** Bolt end */
  L: number;
  nutA: number;
  nutB: number;
  nutH: number;
  rShank: number;
  /** Radius of the bolt end face (below every root) */
  rCore: number;
  /** Nut countersink radius at the faces */
  rCs: number;
  /** Nut translation in the exploded configuration */
  explode: number;
}

export function computeLayout(fit: ThreadFit, dims: ReturnType<typeof visualDims>): Layout {
  const { D, P } = fit;
  const F = 1.5 * D + 0.125;
  const nutH = D - (D <= 1.125 ? 1 / 64 : D <= 2 ? 1 / 32 : 3 / 64);
  const headH = 0.62 * D;
  const xTs = 0.5 * D;
  const nutA = xTs + 0.25 * D + 2 * P;
  const nutB = nutA + nutH;
  const L = nutB + Math.max(3 * P, 0.3 * D);
  const minMinor = Math.min(dims.bolt.MMC.minor, dims.bolt.LMC.minor);
  const maxNutMajor = Math.max(dims.nut.MMC.major, dims.nut.LMC.major);
  const rCore = Math.max(0.05 * D, minMinor / 2 - 0.12 * P);
  const rCs = Math.max(D / 2 + 0.6 * P, maxNutMajor / 2 + 0.2 * P);
  return {
    D,
    P,
    F,
    rCh: 0.475 * F,
    headH,
    xTs,
    L,
    nutA,
    nutB,
    nutH,
    rShank: D / 2,
    rCore,
    rCs,
    explode: L - nutA + 0.6 * D,
  };
}

/** Radius of a hexagon (flats centred at θ = 0°, 60°, …) along direction θ. */
export function hexR(F: number, theta: number): number {
  const sector = Math.PI / 3;
  const rel = theta - Math.round(theta / sector) * sector;
  return F / 2 / Math.cos(rel);
}

export function boltEnvelope(lay: Layout) {
  const { L, xTs, rShank, rCore, P } = lay;
  const slope = (rShank - rCore) / (2 * P);
  return (r: number, x: number) =>
    Math.max(Math.min(r, rCore + (L - x)), rShank - (x - xTs) * slope);
}

export function nutEnvelope(lay: Layout) {
  const { nutA, nutB, rCs } = lay;
  return (r: number, x: number) =>
    Math.max(r, rCs - (x - nutA) * TAN60, rCs - (nutB - x) * TAN60);
}

/* ------------------------------------------------------------------------ */
/* Mesh builders                                                             */
/* ------------------------------------------------------------------------ */

interface Row {
  u: number;
  r: number;
  /** false → no quads between the previous row and this one (crease duplicate) */
  link: boolean;
}

function helixRows(samples: ProfileSample[], P: number, xa: number, xb: number) {
  const period: Array<{ s: number; r: number; link: boolean }> = [];
  for (const smp of samples) {
    period.push({ s: smp.s, r: smp.r, link: true });
    if (smp.crease) period.push({ s: smp.s, r: smp.r, link: false });
  }
  const nLo = Math.floor((xa - P) / P) - 2;
  const nHi = Math.ceil(xb / P) + 2;
  const all: Row[] = [];
  for (let n = nLo; n <= nHi; n++) {
    for (const p of period) all.push({ u: n * P + p.s, r: p.r, link: p.link });
  }
  let j0 = 0;
  for (let j = 0; j < all.length; j++) if (all[j].u <= xa - P) j0 = j;
  let j1 = all.length - 1;
  for (let j = all.length - 1; j >= 0; j--) if (all[j].u >= xb) j1 = j;
  return { rows: all.slice(j0, j1 + 1), perPeriod: period.length };
}

/**
 * Helical thread surface between axial limits xa..xb. `env` modifies the
 * profile radius near the ends (chamfer, runout, countersink) and must return
 * the same radius for every phase at x = xa and x = xb so the ends close into
 * a circle.
 */
export function buildThreadSurface(opts: {
  samples: ProfileSample[];
  P: number;
  xa: number;
  xb: number;
  nTheta: number;
  env: (r: number, x: number) => number;
  inward: boolean;
}): THREE.BufferGeometry {
  const { samples, P, xa, xb, nTheta, env, inward } = opts;
  const { rows, perPeriod } = helixRows(samples, P, xa, xb);
  const nCols = nTheta + 1;
  const nRows = rows.length;
  const pos = new Float32Array(nRows * nCols * 3);
  const cosT = new Float64Array(nCols);
  const sinT = new Float64Array(nCols);
  for (let i = 0; i < nCols; i++) {
    const th = (TWO_PI * i) / nTheta;
    cosT[i] = Math.cos(th);
    sinT[i] = Math.sin(th);
  }
  let p = 0;
  for (let j = 0; j < nRows; j++) {
    const row = rows[j];
    for (let i = 0; i < nCols; i++) {
      let x = row.u + (P * i) / nTheta;
      if (x < xa) x = xa;
      else if (x > xb) x = xb;
      const r = env(row.r, x);
      pos[p++] = x;
      pos[p++] = r * cosT[i];
      pos[p++] = r * sinT[i];
    }
  }
  const quads: number[] = [];
  for (let j = 0; j < nRows - 1; j++) {
    if (!rows[j + 1].link) continue;
    for (let i = 0; i < nTheta; i++) {
      const a = j * nCols + i;
      const b = a + 1;
      const c = a + nCols;
      const d = c + 1;
      if (inward) quads.push(a, c, b, b, c, d);
      else quads.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(quads);
  geo.computeVertexNormals();
  // The column θ = 2π coincides with column 0 one period further along u.
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let j = 0; j + perPeriod < nRows; j++) {
    const ia = j * nCols + nTheta;
    const ib = (j + perPeriod) * nCols;
    v.set(
      nrm.getX(ia) + nrm.getX(ib),
      nrm.getY(ia) + nrm.getY(ib),
      nrm.getZ(ia) + nrm.getZ(ib)
    );
    if (v.lengthSq() < 1e-12) continue;
    v.normalize();
    nrm.setXYZ(ia, v.x, v.y, v.z);
    nrm.setXYZ(ib, v.x, v.y, v.z);
  }
  geo.computeBoundingSphere();
  return geo;
}

interface Col {
  theta: number;
  /** Centre angle of the hex flat this column belongs to (undefined for round bodies) */
  flat?: number;
}

export function hexColumns(perFlat: number): Col[] {
  const cols: Col[] = [];
  for (let f = 0; f < 6; f++) {
    const c = (f * Math.PI) / 3;
    for (let i = 0; i <= perFlat; i++) {
      cols.push({ theta: c - Math.PI / 6 + (Math.PI / 3) * (i / perFlat), flat: c });
    }
  }
  return cols;
}

export function roundColumns(n: number): Col[] {
  const cols: Col[] = [];
  for (let i = 0; i <= n; i++) cols.push({ theta: (TWO_PI * i) / n });
  return cols;
}

/** Grid surface r(θ, x) with analytic normals (outward). */
function buildBodySurface(
  cols: Col[],
  xs: number[],
  radius: (col: Col, x: number) => number,
  normal: (col: Col, x: number, out: THREE.Vector3) => void
): THREE.BufferGeometry {
  const nC = cols.length;
  const nR = xs.length;
  const pos = new Float32Array(nC * nR * 3);
  const nor = new Float32Array(nC * nR * 3);
  const n = new THREE.Vector3();
  let p = 0;
  for (let j = 0; j < nR; j++) {
    for (let i = 0; i < nC; i++) {
      const col = cols[i];
      const r = radius(col, xs[j]);
      normal(col, xs[j], n);
      pos[p] = xs[j];
      pos[p + 1] = r * Math.cos(col.theta);
      pos[p + 2] = r * Math.sin(col.theta);
      nor[p] = n.x;
      nor[p + 1] = n.y;
      nor[p + 2] = n.z;
      p += 3;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nR - 1; j++) {
    if (Math.abs(xs[j + 1] - xs[j]) < 1e-12) continue;
    for (let i = 0; i < nC - 1; i++) {
      const a = j * nC + i;
      const b = a + 1;
      const c = a + nC;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

/** Flat annulus (or disk when rIn ≡ 0) at axial position x, normal ±X. */
function buildFace(
  cols: Col[],
  x: number,
  rIn: (col: Col) => number,
  rOut: (col: Col) => number,
  facing: 1 | -1
): THREE.BufferGeometry {
  const nC = cols.length;
  const pos = new Float32Array(nC * 2 * 3);
  const nor = new Float32Array(nC * 2 * 3);
  for (let i = 0; i < nC; i++) {
    const c = cols[i];
    const cs = Math.cos(c.theta);
    const sn = Math.sin(c.theta);
    const ri = rIn(c);
    const ro = rOut(c);
    pos.set([x, ri * cs, ri * sn, x, ro * cs, ro * sn], i * 6);
    nor.set([facing, 0, 0, facing, 0, 0], i * 6);
  }
  const idx: number[] = [];
  for (let i = 0; i < nC - 1; i++) {
    const a = 2 * i; // inner i
    const b = a + 1; // outer i
    const c = a + 2; // inner i+1
    const d = a + 3; // outer i+1
    // θ increases from +Y to +Z: (outer i → outer i+1) × (inner) gives +X
    if (facing > 0) idx.push(a, b, d, a, d, c);
    else idx.push(a, d, b, a, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

function linspace(a: number, b: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

/** Outward normal of a hex prism with face chamfer cones. */
function hexNormal(
  F: number,
  cone: (x: number) => { r: number; slope: number }
): (col: Col, x: number, out: THREE.Vector3) => void {
  return (col, x, out) => {
    const hr = hexR(F, col.theta);
    const c = cone(x);
    if (hr <= c.r) {
      const f = col.flat ?? col.theta;
      out.set(0, Math.cos(f), Math.sin(f));
    } else {
      // r = r0 + slope·x  → normal ∝ (−slope, 1)
      const len = Math.hypot(c.slope, 1);
      out.set(-c.slope / len, Math.cos(col.theta) / len, Math.sin(col.theta) / len);
    }
  };
}

export interface PartGeometry {
  common: THREE.BufferGeometry[];
  thread: Record<Cond, THREE.BufferGeometry>;
}

export const N_THETA = 160; // divisible by 4 → columns at 0, π/2, π

export function buildBolt(
  lay: Layout,
  profiles: Record<Cond, ProfileSample[]>
): PartGeometry {
  const { F, rCh, headH, xTs, L, rShank, rCore, P } = lay;
  const hexCols = hexColumns(16);
  const chamferLen = (F / Math.sqrt(3) - rCh) * TAN30;
  const x0 = -headH;
  const cone = (x: number) => ({ r: rCh + (x - x0) / TAN30, slope: 1 / TAN30 });
  const headXs = [...linspace(x0, x0 + chamferLen * 1.02, 10), 0];
  const head = buildBodySurface(
    hexCols,
    headXs,
    (c, x) => Math.min(hexR(F, c.theta), cone(x).r),
    hexNormal(F, cone)
  );
  const top = buildFace(roundColumns(96), x0, () => 0, () => rCh, -1);
  const bearing = buildFace(hexCols, 0, () => rShank, (c) => hexR(F, c.theta), 1);
  const shank = buildBodySurface(
    roundColumns(N_THETA),
    [0, xTs],
    () => rShank,
    (c, _x, out) => out.set(0, Math.cos(c.theta), Math.sin(c.theta))
  );
  const tip = buildFace(roundColumns(N_THETA), L, () => 0, () => rCore, 1);
  const env = boltEnvelope(lay);
  const thread = {} as Record<Cond, THREE.BufferGeometry>;
  for (const c of CONDS) {
    thread[c] = buildThreadSurface({
      samples: profiles[c],
      P,
      xa: xTs,
      xb: L,
      nTheta: N_THETA,
      env,
      inward: false,
    });
  }
  return { common: [head, top, bearing, shank, tip], thread };
}

export function buildNut(lay: Layout, profiles: Record<Cond, ProfileSample[]>): PartGeometry {
  const { F, rCh, nutA, nutB, rCs, P } = lay;
  const hexCols = hexColumns(16);
  const chamferLen = (F / Math.sqrt(3) - rCh) * TAN30;
  const cone = (x: number) => {
    const ra = rCh + (x - nutA) / TAN30;
    const rb = rCh + (nutB - x) / TAN30;
    return ra <= rb ? { r: ra, slope: 1 / TAN30 } : { r: rb, slope: -1 / TAN30 };
  };
  const xs = [
    ...linspace(nutA, nutA + chamferLen * 1.02, 10),
    ...linspace(nutB - chamferLen * 1.02, nutB, 10),
  ];
  const body = buildBodySurface(
    hexCols,
    xs,
    (c, x) => Math.min(hexR(F, c.theta), cone(x).r),
    hexNormal(F, cone)
  );
  const faceA = buildFace(roundColumns(N_THETA), nutA, () => rCs, () => rCh, -1);
  const faceB = buildFace(roundColumns(N_THETA), nutB, () => rCs, () => rCh, 1);
  const env = nutEnvelope(lay);
  const thread = {} as Record<Cond, THREE.BufferGeometry>;
  for (const c of CONDS) {
    thread[c] = buildThreadSurface({
      samples: profiles[c],
      P,
      xa: nutA,
      xb: nutB,
      nTheta: N_THETA,
      env,
      inward: true,
    });
  }
  return { common: [body, faceA, faceB], thread };
}

/* ------------------------------------------------------------------------ */
/* Section outlines (2D, in the half-plane at angle θ: x along axis, r ≥ 0)   */
/* ------------------------------------------------------------------------ */

export type Pt = [number, number];

const same = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

/** Drop consecutive duplicates (and a closing point equal to the first). */
function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || !same(p, q)) out.push(p);
  }
  if (out.length > 2 && same(out[0], out[out.length - 1])) out.pop();
  return out;
}

/**
 * Thread boundary in the half-plane θ, from xa to xb, sampled at the same
 * helix rows as the mesh (so it matches the clipped mesh exactly at
 * θ = 0, π/2, π).
 */
export function threadPolyline(
  samples: ProfileSample[],
  P: number,
  xa: number,
  xb: number,
  theta: number,
  env: (r: number, x: number) => number
): Pt[] {
  const shift = (P * theta) / TWO_PI;
  const pts: Pt[] = [];
  const nLo = Math.floor((xa - shift) / P) - 2;
  const nHi = Math.ceil((xb - shift) / P) + 2;
  for (let n = nLo; n <= nHi; n++) {
    for (const smp of samples) {
      const x = n * P + smp.s + shift;
      if (x < xa || x > xb) continue;
      pts.push([x, env(smp.r, x)]);
    }
  }
  // exact end points
  const ra = env(evalProfile(samples, P, xa - shift), xa);
  const rb = env(evalProfile(samples, P, xb - shift), xb);
  return dedupe([[xa, ra], ...pts, [xb, rb]]);
}

/** Polyline r(x) along a body sampled at xs. */
function bodyPolyline(xs: number[], r: (x: number) => number): Pt[] {
  return xs.map((x) => [x, r(x)] as Pt);
}

export interface SectionSet {
  /** Neutral (hatched) region common to both conditions */
  common: Pt[][];
  /** Condition specific regions: the thread zone */
  cond: Record<Cond, Pt[][]>;
  /** Thread boundary of each condition (for outlines) */
  outline: Record<Cond, Pt[]>;
}

export function boltSection(
  lay: Layout,
  profiles: Record<Cond, ProfileSample[]>,
  theta: number
): SectionSet {
  const { F, rCh, headH, xTs, L, rShank, rCore, P } = lay;
  const x0 = -headH;
  const chamferLen = (F / Math.sqrt(3) - rCh) * TAN30;
  const hr = hexR(F, theta);
  const headXs = [...linspace(x0, x0 + chamferLen * 1.02, 10), 0];
  const head = bodyPolyline(headXs, (x) => Math.min(hr, rCh + (x - x0) / TAN30));
  const common: Pt[] = dedupe([
    [x0, 0],
    ...head,
    [0, rShank],
    [xTs, rShank],
    [xTs, rCore],
    [L, rCore],
    [L, 0],
  ]);
  const env = boltEnvelope(lay);
  const cond = {} as Record<Cond, Pt[][]>;
  const outline = {} as Record<Cond, Pt[]>;
  for (const c of CONDS) {
    const line = threadPolyline(profiles[c], P, xTs, L, theta, env);
    outline[c] = line;
    cond[c] = [dedupe([[xTs, rCore], ...line, [L, rCore]])];
  }
  return { common: [common], cond, outline };
}

export function nutSection(
  lay: Layout,
  profiles: Record<Cond, ProfileSample[]>,
  theta: number
): SectionSet {
  const { F, rCh, nutA, nutB, rCs, P } = lay;
  const hr = hexR(F, theta);
  const chamferLen = (F / Math.sqrt(3) - rCh) * TAN30;
  const xs = [
    ...linspace(nutA, nutA + chamferLen * 1.02, 10),
    ...linspace(nutB - chamferLen * 1.02, nutB, 10),
  ];
  const outer = bodyPolyline(xs, (x) =>
    Math.min(hr, rCh + (x - nutA) / TAN30, rCh + (nutB - x) / TAN30)
  );
  const common: Pt[] = dedupe([[nutA, rCs], ...outer, [nutB, rCs]]);
  const env = nutEnvelope(lay);
  const cond = {} as Record<Cond, Pt[][]>;
  const outline = {} as Record<Cond, Pt[]>;
  for (const c of CONDS) {
    const line = threadPolyline(profiles[c], P, nutA, nutB, theta, env);
    outline[c] = line;
    cond[c] = [dedupe([...line, [nutB, rCs], [nutA, rCs]])];
  }
  return { common: [common], cond, outline };
}

/** Gap between bolt and nut over the nut length (assembled only). */
export function clearancePolygon(
  lay: Layout,
  boltSamples: ProfileSample[],
  nutSamples: ProfileSample[],
  theta: number
): Pt[] {
  const { nutA, nutB, P } = lay;
  const bolt = threadPolyline(boltSamples, P, nutA, nutB, theta, boltEnvelope(lay));
  const nut = threadPolyline(nutSamples, P, nutA, nutB, theta, nutEnvelope(lay));
  return dedupe([...bolt, ...nut.reverse()]);
}
