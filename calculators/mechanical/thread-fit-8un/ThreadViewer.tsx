'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ThreadFit } from './b11';
import {
  CONDS,
  basicProfile,
  boltProfile,
  boltEnvelope,
  boltSection,
  buildBolt,
  buildNut,
  computeLayout,
  nutEnvelope,
  nutProfile,
  nutSection,
  interpPolyline as interp,
  regionBetween,
  threadPolyline,
  visualDims,
  type Cond,
  type Layout,
  type PartGeometry,
  type ProfileSample,
  type Pt,
} from './geometry';
import { NO_STRETCH, stretchDx, stretchR, type StretchParams } from './strength';
import { PALETTE, type Config, type Section, type ViewKind, type Visibility } from './viewTypes';

export interface ThreadViewerProps {
  fit: ThreadFit;
  /** Deviation magnification (1 = true scale) */
  k: number;
  config: Config;
  section: Section;
  vis: Visibility;
  dark: boolean;
  view: { kind: ViewKind; n: number };
  /** Grip length [in] (head bearing face to nut face) */
  grip: number;
  /** Working load: displacement field of the bolt (drawing units) and whether it is applied */
  load: { applied: boolean; params: StretchParams };
  className?: string;
}

interface Model {
  fit: ThreadFit;
  k: number;
  lay: Layout;
  boltProfiles: Record<Cond, ProfileSample[]>;
  nutProfiles: Record<Cond, ProfileSample[]>;
  basic: ProfileSample[];
  bolt: PartGeometry;
  nut: PartGeometry;
}

interface ViewState {
  config: Config;
  section: Section;
  vis: Visibility;
  dark: boolean;
}

const FOV = 32;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function hatchTexture(flip: boolean): THREE.CanvasTexture {
  const n = 32;
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, n, n);
  g.strokeStyle = '#6b7280';
  g.lineWidth = 2.2;
  const seg = (x0: number, y0: number, x1: number, y1: number) => {
    g.beginPath();
    g.moveTo(flip ? n - x0 : x0, y0);
    g.lineTo(flip ? n - x1 : x1, y1);
    g.stroke();
  };
  seg(-n / 2, n / 2, n / 2, -n / 2);
  seg(0, n, n, 0);
  seg(n / 2, (3 * n) / 2, (3 * n) / 2, n / 2);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Split long straight edges so the triangulation has no extreme slivers (depth precision). */
function densify(poly: Pt[], maxLen: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    out.push(a);
    const n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxLen);
    for (let j = 1; j <= n; j++) {
      const t = j / (n + 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Ring sprite used to flag interference locations (they can be a pixel thin). */
function ringTexture(color: string): THREE.CanvasTexture {
  const n = 64;
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  const g = cv.getContext('2d')!;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(n / 2, n / 2, n / 2 - 9, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function disposeGroup(g: THREE.Object3D) {
  for (const child of [...g.children]) {
    disposeGroup(child);
    const anyChild = child as THREE.Mesh;
    if (anyChild.geometry) anyChild.geometry.dispose();
    g.remove(child);
  }
}

/** Map 2D section points (x, r) in the half-plane θ to 3D. */
function toWorld(pts: Pt[], theta: number): THREE.Vector3[] {
  const c = Math.round(Math.cos(theta) * 1e9) / 1e9;
  const s = Math.round(Math.sin(theta) * 1e9) / 1e9;
  return pts.map(([x, r]) => new THREE.Vector3(x, r * c, r * s));
}

/**
 * Axial stretch of the bolt, applied in the vertex shader of every bolt
 * material (surfaces, section caps, outlines). Mirrors stretchDx / stretchR
 * in strength.ts — keep the two in sync.
 */
const STRETCH_GLSL = `
uniform float uLoad;
uniform float uXTs;
uniform float uEA;
uniform float uEB;
uniform float uP;
uniform float uDA;
uniform float uStrainB;
uniform float uStrainT;
uniform float uStrainE;
uniform float uRadB;
uniform float uRadT;
float ecDx(float x) {
  if (x >= uEB) return uDA + uStrainE * (uEB - uEA);
  if (x >= uEA) return uDA + uStrainE * (x - uEA);
  if (x >= uXTs) return uDA - uStrainT * (uEA - x);
  float dTs = uDA - uStrainT * (uEA - uXTs);
  if (x >= 0.0) return dTs - uStrainB * (uXTs - x);
  return dTs - uStrainB * uXTs;
}
float ecR(float x) {
  if (x < 0.0) return 1.0;
  if (x < uXTs) return 1.0 - uRadB;
  if (x <= uEB) return 1.0 - uRadT;
  float t = clamp((x - uEB) / uP, 0.0, 1.0);
  return 1.0 - uRadT * (1.0 - t);
}
`;

type StretchUniforms = Record<string, { value: number }>;

function makeStretchUniforms(): StretchUniforms {
  const u: StretchUniforms = { uLoad: { value: 0 } };
  for (const key of ['uXTs', 'uEA', 'uEB', 'uDA', 'uStrainB', 'uStrainT', 'uStrainE', 'uRadB', 'uRadT'])
    u[key] = { value: 0 };
  u.uP = { value: 1 };
  return u;
}

function setStretchUniforms(u: StretchUniforms, sp: StretchParams) {
  u.uXTs.value = sp.xTs;
  u.uEA.value = sp.eA;
  u.uEB.value = sp.eB;
  u.uP.value = sp.P;
  u.uDA.value = sp.dA;
  u.uStrainB.value = sp.strainB;
  u.uStrainT.value = sp.strainT;
  u.uStrainE.value = sp.strainE;
  u.uRadB.value = sp.radB;
  u.uRadT.value = sp.radT;
}

function addStretch(mat: THREE.Material, uniforms: StretchUniforms, worldUv = false) {
  mat.onBeforeCompile = (shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string }) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${STRETCH_GLSL}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float ecx = transformed.x;
          transformed.x += uLoad * ecDx(ecx);
          transformed.yz *= mix(1.0, ecR(ecx), uLoad);
        }${
          worldUv
            ? `
        #ifdef USE_MAP
          // hatch in section-plane coordinates of the displaced point, so it stays straight
          vMapUv = ( mapTransform * vec3( transformed.x, transformed.y + transformed.z, 1.0 ) ).xy;
        #endif`
            : ''
        }`
      );
  };
  mat.customProgramCacheKey = () => (worldUv ? 'ec-bolt-stretch-uv' : 'ec-bolt-stretch');
}

class ThreadScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 1000);
  readonly controls: OrbitControls;
  private readonly container: HTMLElement;
  private readonly ro: ResizeObserver;
  private raf = 0;
  private needsRender = true;

  private readonly boltGroup = new THREE.Group();
  private readonly nutGroup = new THREE.Group();
  private readonly boltCaps = new THREE.Group();
  private readonly nutCaps = new THREE.Group();
  private readonly clrGroup = new THREE.Group();
  private readonly intGroup = new THREE.Group();
  private readonly axisGroup = new THREE.Group();
  /** Lines lying on the plane z = 0 (θ = 0, π) and y = 0 (θ = π/2), lifted towards the viewer each frame */
  private readonly boltLinesZ = new THREE.Group();
  private readonly boltLinesY = new THREE.Group();
  private readonly nutLinesZ = new THREE.Group();
  private readonly nutLinesY = new THREE.Group();

  private model: Model | null = null;
  private meshes: {
    boltCommon: THREE.Mesh[];
    boltThread: Record<Cond, THREE.Mesh>;
    nutCommon: THREE.Mesh[];
    nutThread: Record<Cond, THREE.Mesh>;
  } | null = null;

  private state: ViewState = {
    config: 'assembled',
    section: 'half',
    vis: {
      boltMMC: true,
      boltLMC: true,
      nutMMC: true,
      nutLMC: true,
      basic: false,
      clearance: true,
    },
    dark: false,
  };

  private readonly stretchU = makeStretchUniforms();
  private stretch: StretchParams = NO_STRETCH;
  private loadApplied = false;
  private loadAnim: { from: number; to: number; t0: number; dur: number } | null = null;

  private nutOffset = 0;
  private nutAnim: { from: number; to: number; t0: number; dur: number } | null = null;
  private camAnim: {
    p0: THREE.Vector3;
    p1: THREE.Vector3;
    t0v: THREE.Vector3;
    t1v: THREE.Vector3;
    t0: number;
    dur: number;
  } | null = null;

  private readonly planeZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  private readonly planeY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

  private readonly hatchBolt = hatchTexture(false);
  private readonly hatchNut = hatchTexture(true);
  private readonly ringTex = ringTexture(PALETTE.interference);
  private readonly envTex: THREE.Texture;

  readonly mats = {
    boltSteel: new THREE.MeshStandardMaterial({
      color: PALETTE.boltSteel,
      metalness: 0.65,
      roughness: 0.34,
      side: THREE.DoubleSide,
    }),
    nutSteel: new THREE.MeshStandardMaterial({
      color: PALETTE.nutSteel,
      metalness: 0.65,
      roughness: 0.4,
      side: THREE.DoubleSide,
    }),
    boltThread: {
      MMC: new THREE.MeshStandardMaterial({
        color: PALETTE.boltMMC.solid,
        metalness: 0.3,
        roughness: 0.42,
        side: THREE.DoubleSide,
      }),
      LMC: new THREE.MeshStandardMaterial({
        color: PALETTE.boltLMC.solid,
        metalness: 0.3,
        roughness: 0.42,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 2,
      }),
    } as Record<Cond, THREE.MeshStandardMaterial>,
    nutThread: {
      MMC: new THREE.MeshStandardMaterial({
        color: PALETTE.nutMMC.solid,
        metalness: 0.3,
        roughness: 0.42,
        side: THREE.DoubleSide,
      }),
      LMC: new THREE.MeshStandardMaterial({
        color: PALETTE.nutLMC.solid,
        metalness: 0.3,
        roughness: 0.42,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 2,
      }),
    } as Record<Cond, THREE.MeshStandardMaterial>,
    boltHatch: this.capMaterial('#ffffff', 1, this.hatchBolt),
    nutHatch: this.capMaterial('#ffffff', 1, this.hatchNut),
    boltCap: {
      MMC: this.capMaterial(PALETTE.boltMMC.fill, 2),
      LMC: this.capMaterial(PALETTE.boltLMC.fill, 3),
    } as Record<Cond, THREE.MeshBasicMaterial>,
    nutCap: {
      MMC: this.capMaterial(PALETTE.nutMMC.fill, 2),
      LMC: this.capMaterial(PALETTE.nutLMC.fill, 3),
    } as Record<Cond, THREE.MeshBasicMaterial>,
    clearance: this.capMaterial(PALETTE.clearance, 1),
    interference: this.capMaterial(PALETTE.interference, 5),
    marker: new THREE.PointsMaterial({
      size: 22,
      sizeAttenuation: false,
      map: this.ringTex,
      transparent: true,
      alphaTest: 0.05,
      depthTest: false,
      toneMapped: false,
    }),
    boltLine: {
      MMC: new THREE.LineBasicMaterial({ color: PALETTE.boltMMC.line, toneMapped: false }),
      LMC: new THREE.LineBasicMaterial({ color: PALETTE.boltLMC.line, toneMapped: false }),
    } as Record<Cond, THREE.LineBasicMaterial>,
    nutLine: {
      MMC: new THREE.LineBasicMaterial({ color: PALETTE.nutMMC.line, toneMapped: false }),
      LMC: new THREE.LineBasicMaterial({ color: PALETTE.nutLMC.line, toneMapped: false }),
    } as Record<Cond, THREE.LineBasicMaterial>,
    basic: new THREE.LineDashedMaterial({
      color: PALETTE.basic.light,
      dashSize: 0.01,
      gapSize: 0.006,
      toneMapped: false,
    }),
    axis: new THREE.LineDashedMaterial({
      color: '#64748b',
      dashSize: 0.1,
      gapSize: 0.04,
      toneMapped: false,
    }),
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.9;

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 6, 8);
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.4));

    this.boltGroup.add(this.boltCaps, this.boltLinesZ, this.boltLinesY);
    this.nutGroup.add(this.nutCaps, this.nutLinesZ, this.nutLinesY);
    this.scene.add(this.boltGroup, this.nutGroup, this.clrGroup, this.intGroup, this.axisGroup);

    for (const mat of [
      this.mats.boltSteel,
      ...Object.values(this.mats.boltThread),
      ...Object.values(this.mats.boltCap),
      ...Object.values(this.mats.boltLine),
    ])
      addStretch(mat, this.stretchU);
    addStretch(this.mats.boltHatch, this.stretchU, true);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener('change', () => (this.needsRender = true));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  private capMaterial(color: string, layer: number, map?: THREE.Texture) {
    return new THREE.MeshBasicMaterial({
      color,
      map: map ?? null,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -layer,
      polygonOffsetUnits: -4 * layer,
    });
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let changed = this.controls.update();
    if (this.nutAnim) {
      const a = this.nutAnim;
      const t = Math.min(1, (now - a.t0) / a.dur);
      this.nutOffset = a.from + (a.to - a.from) * ease(t);
      this.nutGroup.position.x = this.nutOffset;
      if (t >= 1) {
        this.nutAnim = null;
        this.updateClearanceVisibility();
      }
      changed = true;
    }
    if (this.loadAnim) {
      const a = this.loadAnim;
      const t = Math.min(1, (now - a.t0) / a.dur);
      this.stretchU.uLoad.value = a.from + (a.to - a.from) * ease(t);
      if (t >= 1) {
        this.loadAnim = null;
        this.rebuildFills();
      }
      changed = true;
    }
    if (this.camAnim) {
      const a = this.camAnim;
      const t = Math.min(1, (now - a.t0) / a.dur);
      const e = ease(t);
      this.camera.position.lerpVectors(a.p0, a.p1, e);
      this.controls.target.lerpVectors(a.t0v, a.t1v, e);
      if (t >= 1) this.camAnim = null;
      changed = true;
    }
    if (changed || this.needsRender) {
      this.updateDepthAndLift();
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
  };

  /**
   * Section outlines sit exactly on the cut plane, under the polygon-offset
   * caps. Lift them towards the camera by a small fraction of the viewing
   * distance, and scale the near plane with the distance so depth precision
   * stays proportional at every zoom level.
   */
  private updateDepthAndLift() {
    const d = this.camera.position.distanceTo(this.controls.target);
    const D = this.model?.fit.D ?? 1;
    const near = Math.max(D / 2000, d / 60);
    if (Math.abs(near - this.camera.near) > 1e-9) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    const lift = 0.002 * d;
    const sz = this.camera.position.z >= 0 ? 1 : -1;
    const sy = this.camera.position.y >= 0 ? 1 : -1;
    this.boltLinesZ.position.z = sz * lift;
    this.nutLinesZ.position.z = sz * lift;
    this.axisGroup.position.z = sz * lift;
    this.boltLinesY.position.y = sy * lift;
    this.nutLinesY.position.y = sy * lift;
  }

  /* -------------------------------------------------------------- model */

  setModel(fit: ThreadFit, k: number, grip: number) {
    const prev = this.model;
    const dims = visualDims(fit, k);
    const lay = computeLayout(fit, dims, grip);
    const boltProfiles = {
      MMC: boltProfile(dims.bolt.MMC, fit.P),
      LMC: boltProfile(dims.bolt.LMC, fit.P),
    };
    const nutProfiles = {
      MMC: nutProfile(dims.nut.MMC, fit.P),
      LMC: nutProfile(dims.nut.LMC, fit.P),
    };
    const bolt = buildBolt(lay, boltProfiles);
    const nut = buildNut(lay, nutProfiles);

    this.disposeModel();
    this.model = { fit, k, lay, boltProfiles, nutProfiles, basic: basicProfile(fit), bolt, nut };

    const mk = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);
    this.meshes = {
      boltCommon: bolt.common.map((g) => mk(g, this.mats.boltSteel)),
      boltThread: {
        MMC: mk(bolt.thread.MMC, this.mats.boltThread.MMC),
        LMC: mk(bolt.thread.LMC, this.mats.boltThread.LMC),
      },
      nutCommon: nut.common.map((g) => mk(g, this.mats.nutSteel)),
      nutThread: {
        MMC: mk(nut.thread.MMC, this.mats.nutThread.MMC),
        LMC: mk(nut.thread.LMC, this.mats.nutThread.LMC),
      },
    };
    this.boltGroup.add(...this.meshes.boltCommon, this.meshes.boltThread.MMC, this.meshes.boltThread.LMC);
    // the vertex shader stretches the bolt beyond its bounding sphere
    for (const mesh of [...this.meshes.boltCommon, ...Object.values(this.meshes.boltThread)])
      mesh.frustumCulled = false;
    this.nutGroup.add(...this.meshes.nutCommon, this.meshes.nutThread.MMC, this.meshes.nutThread.LMC);

    const spacing = fit.D / 14;
    for (const t of [this.hatchBolt, this.hatchNut]) t.repeat.set(1 / spacing, 1 / spacing);
    this.mats.basic.dashSize = fit.P / 10;
    this.mats.basic.gapSize = fit.P / 16;
    this.mats.axis.dashSize = fit.D / 5;
    this.mats.axis.gapSize = fit.D / 14;

    this.camera.far = fit.D * 200;
    this.camera.updateProjectionMatrix();

    // keep the nut where the configuration wants it
    this.nutOffset = this.state.config === 'exploded' ? lay.explode : 0;
    this.nutAnim = null;
    this.nutGroup.position.x = this.nutOffset;

    this.applyState();
    if (!prev || prev.fit.D !== fit.D || prev.lay.grip !== grip) this.view(prev ? 'fit' : 'iso', !prev);
    this.needsRender = true;
  }

  private disposeModel() {
    if (!this.meshes || !this.model) return;
    const all = [
      ...this.meshes.boltCommon,
      ...this.meshes.nutCommon,
      ...Object.values(this.meshes.boltThread),
      ...Object.values(this.meshes.nutThread),
    ];
    for (const m of all) {
      m.parent?.remove(m);
      m.geometry.dispose();
    }
    this.meshes = null;
  }

  /* -------------------------------------------------------------- state */

  setState(next: ViewState) {
    const prev = this.state;
    this.state = next;
    if (!this.model) return;
    const configChanged = prev.config !== next.config;
    this.applyState();
    if (configChanged) {
      const lay = this.model.lay;
      const target = next.config === 'exploded' ? lay.explode : 0;
      if (Math.abs(target - this.nutOffset) > 1e-9) {
        this.nutAnim = { from: this.nutOffset, to: target, t0: performance.now(), dur: 650 };
        this.updateClearanceVisibility();
      }
      this.view('fit', false, target);
    }
  }

  /** Apply / remove the working load (animated) or update its displacement field. */
  setLoad(applied: boolean, params: StretchParams) {
    this.stretch = params;
    setStretchUniforms(this.stretchU, params);
    if (applied !== this.loadApplied) {
      this.loadApplied = applied;
      this.loadAnim = {
        from: this.stretchU.uLoad.value,
        to: applied ? 1 : 0,
        t0: performance.now(),
        dur: 750,
      };
      this.updateClearanceVisibility();
    } else if (!this.loadAnim) {
      this.rebuildFills();
    }
    this.needsRender = true;
  }

  private boltShown() {
    const { config, vis } = this.state;
    return config !== 'nut' && (vis.boltMMC || vis.boltLMC);
  }

  private nutShown() {
    const { config, vis } = this.state;
    return config !== 'bolt' && (vis.nutMMC || vis.nutLMC);
  }

  private applyState() {
    if (!this.model || !this.meshes) return;
    const { vis, section, dark } = this.state;

    this.boltGroup.visible = this.boltShown();
    this.nutGroup.visible = this.nutShown();
    this.meshes.boltThread.MMC.visible = vis.boltMMC;
    this.meshes.boltThread.LMC.visible = vis.boltLMC;
    this.meshes.nutThread.MMC.visible = vis.nutMMC;
    this.meshes.nutThread.LMC.visible = vis.nutLMC;

    const planes =
      section === 'half' ? [this.planeZ] : section === 'quarter' ? [this.planeZ, this.planeY] : [];
    const clipped: THREE.Material[] = [
      this.mats.boltSteel,
      this.mats.nutSteel,
      ...Object.values(this.mats.boltThread),
      ...Object.values(this.mats.nutThread),
    ];
    for (const m of clipped) {
      m.clippingPlanes = planes;
      m.clipIntersection = section === 'quarter';
      m.needsUpdate = true;
    }

    this.scene.background = new THREE.Color(dark ? '#0f1318' : '#f4f6f9');
    this.mats.boltHatch.color.set(dark ? '#7c8796' : '#d5dbe3');
    this.mats.nutHatch.color.set(dark ? '#6b7584' : '#c4ccd6');
    this.mats.basic.color.set(dark ? PALETTE.basic.dark : PALETTE.basic.light);
    this.mats.axis.color.set(dark ? '#94a3b8' : '#64748b');

    this.rebuildCaps();
    this.updateClearanceVisibility();
    this.needsRender = true;
  }

  private updateClearanceVisibility() {
    const { config, section } = this.state;
    const fillsOk =
      section !== 'none' &&
      config === 'assembled' &&
      !this.nutAnim &&
      !this.loadAnim &&
      Math.abs(this.nutOffset) < 1e-9 &&
      this.boltShown() &&
      this.nutShown();
    this.clrGroup.visible = fillsOk;
    this.intGroup.visible = fillsOk && this.loadApplied;
    this.needsRender = true;
  }

  private addCap(group: THREE.Group, polys: Pt[][], theta: number, mat: THREE.Material) {
    const maxLen = this.model ? this.model.lay.P / 2 : 0.0625;
    for (const raw of polys) {
      if (raw.length < 3) continue;
      const poly = densify(raw, maxLen);
      const shape = new THREE.Shape(poly.map(([x, r]) => new THREE.Vector2(x, r)));
      const geo = new THREE.ShapeGeometry(shape);
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      const c = Math.round(Math.cos(theta) * 1e9) / 1e9;
      const s = Math.round(Math.sin(theta) * 1e9) / 1e9;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const r = pos.getY(i);
        pos.setXYZ(i, x, r * c, r * s);
        uv.setXY(i, x, r * (c + s));
      }
      pos.needsUpdate = true;
      uv.needsUpdate = true;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 1;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
  }

  private addLine(part: 'bolt' | 'nut' | 'axis', pts: Pt[], theta: number, mat: THREE.Material, dashed = false) {
    if (pts.length < 2) return;
    const onY = theta === Math.PI / 2;
    const group =
      part === 'axis'
        ? this.axisGroup
        : part === 'bolt'
          ? onY
            ? this.boltLinesY
            : this.boltLinesZ
          : onY
            ? this.nutLinesY
            : this.nutLinesZ;
    const geo = new THREE.BufferGeometry().setFromPoints(toWorld(pts, theta));
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    if (dashed) line.computeLineDistances();
    line.renderOrder = 2;
    group.add(line);
  }

  private capGroups() {
    return [
      this.boltCaps,
      this.nutCaps,
      this.clrGroup,
      this.intGroup,
      this.axisGroup,
      this.boltLinesZ,
      this.boltLinesY,
      this.nutLinesZ,
      this.nutLinesY,
    ];
  }

  private rebuildCaps() {
    for (const g of this.capGroups()) disposeGroup(g);
    const m = this.model;
    if (!m) return;
    const { section, vis } = this.state;
    if (section === 'none') return;
    const { lay } = m;
    const P = lay.P;
    const thetas = section === 'half' ? [0, Math.PI] : [0, Math.PI / 2];
    const boltOn = { MMC: vis.boltMMC, LMC: vis.boltLMC };
    const nutOn = { MMC: vis.nutMMC, LMC: vis.nutLMC };
    const ident = (r: number) => r;

    for (const th of thetas) {
      const bs = boltSection(lay, m.boltProfiles, th);
      this.addCap(this.boltCaps, bs.common, th, this.mats.boltHatch);
      for (const c of CONDS) {
        if (!boltOn[c]) continue;
        this.addCap(this.boltCaps, bs.cond[c], th, this.mats.boltCap[c]);
        this.addLine('bolt', bs.outline[c], th, this.mats.boltLine[c]);
      }
      const ns = nutSection(lay, m.nutProfiles, th);
      this.addCap(this.nutCaps, ns.common, th, this.mats.nutHatch);
      for (const c of CONDS) {
        if (!nutOn[c]) continue;
        this.addCap(this.nutCaps, ns.cond[c], th, this.mats.nutCap[c]);
        this.addLine('nut', ns.outline[c], th, this.mats.nutLine[c]);
      }
      if (vis.basic) {
        const bb = threadPolyline(m.basic, P, lay.xTs + 2 * P, lay.L - P, th, ident);
        this.addLine('bolt', bb, th, this.mats.basic, true);
        const nb = threadPolyline(m.basic, P, lay.nutA + P / 2, lay.nutB - P / 2, th, ident);
        this.addLine('nut', nb, th, this.mats.basic, true);
      }
    }
    // centre line (chain line) on the section plane
    const x0 = -lay.headH - 0.25 * lay.D;
    const x1 = lay.L + lay.explode + 0.25 * lay.D;
    this.addLine('axis', [[x0, 0], [x1, 0]], 0, this.mats.axis, true);
    this.rebuildFills();
  }

  /**
   * Clearance (nut above bolt) and interference (bolt above nut) on the
   * section plane, from the visible bolt and nut conditions. The bolt profile
   * is displaced with the same function as the vertex shader.
   */
  private rebuildFills() {
    disposeGroup(this.clrGroup);
    disposeGroup(this.intGroup);
    const m = this.model;
    if (!m) return;
    const { section, vis } = this.state;
    if (section === 'none') return;
    const bc: Cond | null = vis.boltMMC ? 'MMC' : vis.boltLMC ? 'LMC' : null;
    const nc: Cond | null = vis.nutMMC ? 'MMC' : vis.nutLMC ? 'LMC' : null;
    if (!bc || !nc) return;
    const { lay } = m;
    const P = lay.P;
    const loaded = this.loadApplied;
    const sp = this.stretch;
    const thetas = section === 'half' ? [0, Math.PI] : [0, Math.PI / 2];
    for (const th of thetas) {
      const raw = threadPolyline(m.boltProfiles[bc], P, lay.nutA - P, lay.nutB + P, th, boltEnvelope(lay));
      const bolt: Pt[] = loaded
        ? raw.map(([x, r]) => [x + stretchDx(sp, x), r * stretchR(sp, x)] as Pt)
        : raw;
      const nut = threadPolyline(m.nutProfiles[nc], P, lay.nutA, lay.nutB, th, nutEnvelope(lay));
      if (vis.clearance) {
        this.addCap(this.clrGroup, regionBetween(bolt, nut, lay.nutA, lay.nutB), th, this.mats.clearance);
      }
      if (loaded) {
        const ints = regionBetween(nut, bolt, lay.nutA, lay.nutB);
        this.addCap(this.intGroup, ints, th, this.mats.interference);
        // ring markers: one per overlapping flank, at the deepest point
        const marks: Pt[] = ints.map((poly) => {
          const xs = poly.map((q) => q[0]);
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs);
          let best = -Infinity;
          let bx = x0;
          for (let i = 0; i <= 24; i++) {
            const x = x0 + ((x1 - x0) * i) / 24;
            const d = interp(bolt, x) - interp(nut, x);
            if (d > best) {
              best = d;
              bx = x;
            }
          }
          return [bx, (interp(bolt, bx) + interp(nut, bx)) / 2] as Pt;
        });
        if (marks.length) {
          const geo = new THREE.BufferGeometry().setFromPoints(toWorld(marks, th));
          const pts = new THREE.Points(geo, this.mats.marker);
          pts.renderOrder = 10;
          pts.frustumCulled = false;
          this.intGroup.add(pts);
        }
      }
    }
    this.updateClearanceVisibility();
  }

  /* -------------------------------------------------------------- camera */

  private bounds(nutOffset: number): THREE.Box3 {
    const box = new THREE.Box3();
    const m = this.model;
    if (!m) return box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const { lay } = m;
    const rc = lay.F / Math.sqrt(3);
    if (this.boltShown()) {
      const dHead = this.loadApplied ? stretchDx(this.stretch, -1) : 0;
      box.expandByPoint(new THREE.Vector3(-lay.headH + dHead, -rc, -rc));
      box.expandByPoint(new THREE.Vector3(lay.L, rc, rc));
    }
    if (this.nutShown()) {
      box.expandByPoint(new THREE.Vector3(lay.nutA + nutOffset, -rc, -rc));
      box.expandByPoint(new THREE.Vector3(lay.nutB + nutOffset, rc, rc));
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    return box;
  }

  private viewDir(kind: ViewKind): THREE.Vector3 {
    if (kind === 'front') return new THREE.Vector3(0, 0, 1);
    if (this.state.section === 'quarter') return new THREE.Vector3(0.45, 0.75, 0.95).normalize();
    return new THREE.Vector3(0.55, 0.5, 1).normalize();
  }

  view(kind: ViewKind, instant = false, nutOffset = this.nutOffset) {
    const m = this.model;
    if (!m) return;
    const { lay } = m;
    let target: THREE.Vector3;
    let dir: THREE.Vector3;
    let dist: number;
    const vFov = THREE.MathUtils.degToRad(FOV) / 2;
    const hFov = Math.atan(Math.tan(vFov) * this.camera.aspect);

    if (kind === 'detail') {
      const P = lay.P;
      let xm = (lay.nutA + lay.nutB) / 2;
      if (this.state.config === 'exploded') xm = (lay.xTs + lay.L) / 2 + P;
      xm = Math.round(xm / P) * P;
      // loaded: the far end of the engagement, where the back flanks close first
      if (this.loadApplied && this.state.config === 'assembled') xm = Math.floor((lay.eB - 0.5 * P) / P) * P;
      target = new THREE.Vector3(xm, m.fit.E / 2, 0);
      dir = new THREE.Vector3(0.12, 0.1, 1).normalize();
      dist = (2.0 * P) / Math.tan(Math.min(vFov, hFov));
    } else {
      const box = this.bounds(nutOffset);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      target = sphere.center.clone();
      dir = kind === 'fit' ? this.currentDir() : this.viewDir(kind);
      dist = (sphere.radius / Math.sin(Math.min(vFov, hFov))) * 0.92;
    }
    const pos = target.clone().addScaledVector(dir, dist);
    if (instant) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      this.needsRender = true;
      return;
    }
    this.camAnim = {
      p0: this.camera.position.clone(),
      p1: pos,
      t0v: this.controls.target.clone(),
      t1v: target,
      t0: performance.now(),
      dur: 550,
    };
  }

  private currentDir(): THREE.Vector3 {
    const d = this.camera.position.clone().sub(this.controls.target);
    if (d.lengthSq() < 1e-12) return this.viewDir('iso');
    return d.normalize();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    for (const g of this.capGroups()) disposeGroup(g);
    this.disposeModel();
    const mats: THREE.Material[] = [];
    const collect = (v: unknown) => {
      if (v instanceof THREE.Material) mats.push(v);
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    };
    collect(this.mats);
    mats.forEach((mm) => mm.dispose());
    this.hatchBolt.dispose();
    this.hatchNut.dispose();
    this.ringTex.dispose();
    this.envTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export default function ThreadViewer({
  fit,
  k,
  config,
  section,
  vis,
  dark,
  view,
  grip,
  load,
  className,
}: ThreadViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreadScene | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const s = new ThreadScene(hostRef.current);
    sceneRef.current = s;
    return () => {
      s.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setState({ config, section, vis, dark });
  }, [config, section, vis, dark]);

  useEffect(() => {
    // rebuild geometry shortly after the last change (slider drags)
    const id = window.setTimeout(() => sceneRef.current?.setModel(fit, k, grip), 60);
    return () => window.clearTimeout(id);
  }, [fit, k, grip]);

  useEffect(() => {
    sceneRef.current?.setLoad(load.applied, load.params);
  }, [load]);

  useEffect(() => {
    if (view.n > 0) sceneRef.current?.view(view.kind);
  }, [view]);

  return <div ref={hostRef} className={className} />;
}
