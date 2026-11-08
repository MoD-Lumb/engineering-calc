// Framework-agnostic three.js scene for the oil production plant explainer.
// Everything is built procedurally from primitives (no external models), in a
// "diorama" style: x runs along the process flow (wells on the left, export on the
// right), the gas train is at the back (−z) and the water train at the front (+z).
// One scene unit ≈ one metre for the surface plant; the subsurface is not to scale.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EQUIPMENT,
  STREAMS,
  SYSTEMS,
  type EquipmentId,
  type StreamKey,
} from './equipment';

export type StreamFocus = StreamKey | 'all';
export type LabelMode = 'off' | 'numbers' | 'names';

export interface FlowRates {
  well: number;
  oil: number;
  gas: number;
  water: number;
}

export interface PlantSceneOptions {
  dark: boolean;
  onSelect: (id: EquipmentId | null) => void;
}

export interface PlantScene {
  select(id: EquipmentId | null, fly?: boolean): void;
  setStreamFocus(focus: StreamFocus): void;
  setCutaway(on: boolean): void;
  setUnderground(on: boolean): void;
  setLabels(mode: LabelMode): void;
  setAnimate(on: boolean): void;
  setFlowRates(rates: FlowRates): void;
  setDark(dark: boolean): void;
  resetView(): void;
  dispose(): void;
}

type V3 = [number, number, number];

const PITCH = 1.1; // world length of one flow chevron
const BASE_FLOW_SPEED = 2.2; // world units per second at nominal rate
const UP = new THREE.Vector3(0, 1, 0);

// Plant footprint (diorama base)
const X0 = -46;
const X1 = 48;
const Z0 = -18;
const Z1 = 18;

const HOME_TARGET = new THREE.Vector3(3, -1.5, 0);
const HOME_POS = new THREE.Vector3(14, 47, 81);

const LABEL_POS: Record<EquipmentId, V3> = {
  reservoir: [-31, -5.5, Z1 + 0.2],
  wells: [-38, 4.6, 0],
  manifold: [-30.3, 3.0, -3.5],
  'test-separator': [-21.5, 3.4, 10],
  'inlet-heater': [-21.2, 4.2, 0],
  'hp-separator': [-9, 5.0, 1.0],
  'lp-separator': [3, 4.4, 0.6],
  treater: [14, 5.6, 0],
  stabilizer: [22.5, 15.4, -3.5],
  storage: [31.5, 7.2, 0],
  export: [40.5, 2.8, 0],
  scrubber: [8, 8.2, -11],
  compressor: [13, 3.8, -11],
  dehydration: [25.2, 13.6, -11],
  'gas-export': [36, 3.0, -11],
  flare: [-27.6, 20.5, -14],
  hydrocyclone: [-1, 2.8, 11],
  flotation: [8, 3.8, 11],
  injection: [19, 3.0, 11],
  'control-room': [40.5, 5.0, 11.5],
};

// Custom camera framing for items whose bounding box is not a good guide.
const CUSTOM_VIEW: Partial<Record<EquipmentId, { target: V3; pos: V3 }>> = {
  reservoir: { target: [-28, -4.5, 8], pos: [-18, 4, 46] },
  wells: { target: [-36, -1, 0], pos: [-22, 9, 26] },
  flare: { target: [-27, 11, -14], pos: [-6, 15, 24] },
  storage: { target: [31.5, 2, 0], pos: [42, 16, 26] },
  // views from the back-right so the stabilizer and tanks don't block the gas train
  dehydration: { target: [25.5, 5.5, -12], pos: [41, 15, -1] },
  'gas-export': { target: [36.5, 1, -11.8], pos: [47, 12, -1] },
};

interface Particles {
  mesh: THREE.InstancedMesh;
  pos: Float32Array;
  speed: Float32Array;
  min: THREE.Vector3;
  max: THREE.Vector3;
  vy: number; // sign/direction (+ up, − down)
  drift: number; // x drift
}

export function createPlantScene(host: HTMLElement, opts: PlantSceneOptions): PlantScene {
  // ---------------------------------------------------------------- renderer
  let width = Math.max(host.clientWidth, 10);
  let height = Math.max(host.clientHeight, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.outline = 'none';
  host.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(width, height);
  const labelRoot = labelRenderer.domElement;
  labelRoot.style.position = 'absolute';
  labelRoot.style.inset = '0';
  labelRoot.style.pointerEvents = 'none';
  labelRoot.style.zIndex = '1'; // own stacking context so labels stay under the UI overlays
  labelRoot.className = 'plant-labels labels-numbers';
  host.appendChild(labelRoot);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 800);
  /** Home camera position, pulled back on narrow (portrait) viewers so the whole plant fits. */
  function homePos() {
    const k = Math.max(1, 1.35 / camera.aspect);
    return HOME_TARGET.clone().add(HOME_POS.clone().sub(HOME_TARGET).multiplyScalar(k));
  }
  camera.position.copy(homePos());

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();

  // ------------------------------------------------------------------ lights
  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x5d4a36, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.4);
  sun.position.set(36, 62, 34);
  sun.target.position.set(1, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -66;
  sc.right = 66;
  sc.top = 50;
  sc.bottom = -50;
  sc.near = 10;
  sc.far = 180;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // --------------------------------------------------------------- materials
  const textures: THREE.Texture[] = [];

  function std(
    color: THREE.ColorRepresentation,
    metalness = 0.2,
    roughness = 0.6,
    extra: THREE.MeshStandardMaterialParameters = {}
  ) {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  }

  const MAT = {
    vessel: std('#e2e6ea', 0.35, 0.42),
    vesselWarm: std('#d8cfbf', 0.3, 0.5),
    column: std('#d3d8dd', 0.35, 0.42),
    tank: std('#f1f3f5', 0.25, 0.5),
    steel: std('#7d8792', 0.6, 0.42),
    darkSteel: std('#3e454d', 0.5, 0.5),
    idlePipe: std('#9aa3ad', 0.5, 0.45),
    yellow: std('#e2b23a', 0.25, 0.55),
    grating: std('#8a8f73', 0.4, 0.7, { side: THREE.DoubleSide }),
    red: std('#cf3a2e', 0.2, 0.5),
    motor: std('#2f5d9e', 0.35, 0.45),
    pump: std('#3d8a5c', 0.3, 0.5),
    concrete: std('#bdb8ad', 0.0, 0.95),
    asphalt: std('#3a3d42', 0, 0.95),
    building: std('#ebe6dc', 0.05, 0.85),
    roof: std('#6b7280', 0.3, 0.6),
    window: std('#7fb6e6', 0.1, 0.2, { emissive: '#4d93d6', emissiveIntensity: 0.7 }),
    oil: std('#6e3f12', 0.05, 0.28),
    water: std('#2f7fd6', 0.05, 0.22),
    bath: std('#4f9be3', 0.0, 0.2, { transparent: true, opacity: 0.38, depthWrite: false }),
    glycol: std('#9b59d0', 0.1, 0.35),
    froth: std('#efe9dc', 0, 0.9),
    meshPad: std('#a7adb3', 0.6, 0.75),
    fireTube: std('#ff8a3d', 0, 0.5, { emissive: '#ff5a10', emissiveIntensity: 1.4 }),
    electrode: std('#9fd3ff', 0.2, 0.3, { emissive: '#5fb2ff', emissiveIntensity: 1.2 }),
    perfOil: std('#ffb15c', 0, 0.5, { emissive: '#ff8a1e', emissiveIntensity: 1.2 }),
    perfWater: std('#7cc0ff', 0, 0.5, { emissive: '#3b8cff', emissiveIntensity: 1.2 }),
    sock: std('#f97316', 0.0, 0.8, { side: THREE.DoubleSide }),
  };

  // Flow chevron textures (shared image, separate offsets per stream)
  function chevronCanvas(bg: string, fg: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = fg;
    g.lineWidth = 9;
    g.lineJoin = 'miter';
    g.beginPath();
    g.moveTo(8, 46);
    g.lineTo(32, 20);
    g.lineTo(56, 46);
    g.stroke();
    return c;
  }
  const chevronMapCanvas = chevronCanvas('#b9b9b9', '#ffffff');
  const chevronGlowCanvas = chevronCanvas('#000000', '#ffffff');

  function makeTex(canvas: HTMLCanvasElement, srgb: boolean) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    textures.push(t);
    return t;
  }

  interface StreamMats {
    pipe: THREE.MeshStandardMaterial;
    joint: THREE.MeshStandardMaterial;
    map: THREE.Texture;
    glow: THREE.Texture;
    rate: number;
  }
  const streamMats = {} as Record<StreamKey, StreamMats>;
  (Object.keys(STREAMS) as StreamKey[]).forEach((key) => {
    const color = new THREE.Color(STREAMS[key].color);
    const map = makeTex(chevronMapCanvas, true);
    const glow = makeTex(chevronGlowCanvas, false);
    const pipe = new THREE.MeshStandardMaterial({
      color,
      map,
      emissive: color,
      emissiveMap: glow,
      emissiveIntensity: 0.55,
      roughness: 0.45,
      metalness: 0.15,
    });
    const joint = new THREE.MeshStandardMaterial({
      color: color.clone().multiplyScalar(0.85),
      roughness: 0.45,
      metalness: 0.15,
    });
    streamMats[key] = { pipe, joint, map, glow, rate: key === 'glycol' ? 0.6 : key === 'flare' ? 0.35 : 1 };
  });

  // ------------------------------------------------------------ cutaway state
  let cutaway = true;
  const cutMats: Array<{ mat: THREE.Material; plane: THREE.Plane }> = [];
  const cutOnly: THREE.Object3D[] = [];
  const solidOnly: THREE.Object3D[] = [];

  /** A double-sided copy of `base` whose front half (z > zc) is clipped away in cutaway mode. */
  function shellMat(base: THREE.MeshStandardMaterial, zc: number) {
    const m = base.clone();
    m.side = THREE.DoubleSide;
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), zc);
    m.clippingPlanes = cutaway ? [plane] : null;
    cutMats.push({ mat: m, plane });
    return m;
  }

  // -------------------------------------------------------- equipment groups
  const eqGroups = new Map<EquipmentId, THREE.Group>();
  function eqGroup(id: EquipmentId) {
    let g = eqGroups.get(id);
    if (!g) {
      g = new THREE.Group();
      g.name = id;
      g.userData.eqId = id;
      scene.add(g);
      eqGroups.set(id, g);
    }
    return g;
  }

  // --------------------------------------------------------- mesh helpers
  function add<T extends THREE.Object3D>(parent: THREE.Object3D, o: T, x = 0, y = 0, z = 0): T {
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  function box(
    p: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material | THREE.Material[],
    x = 0,
    y = 0,
    z = 0
  ) {
    return add(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
  }
  function cyl(
    p: THREE.Object3D,
    rt: number,
    rb: number,
    h: number,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    seg = 24,
    open = false
  ) {
    return add(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat), x, y, z);
  }
  /** Cylinder with its axis along x. */
  function xcyl(p: THREE.Object3D, r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 24) {
    const m = cyl(p, r, r, len, mat, x, y, z, seg);
    m.rotation.z = Math.PI / 2;
    return m;
  }
  /** Cylinder with its axis along z. */
  function zcyl(p: THREE.Object3D, r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 24) {
    const m = cyl(p, r, r, len, mat, x, y, z, seg);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function torus(p: THREE.Object3D, r: number, tube: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
    return add(p, new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24), mat), x, y, z);
  }

  /** Back-half (z ≤ 0) slab of a horizontal cylinder (axis x) between heights y0 and y1. */
  function hSlabGeo(R: number, y0: number, y1: number, length: number) {
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const a0 = Math.asin(clamp(y0 / R));
    const a1 = Math.asin(clamp(y1 / R));
    const shape = new THREE.Shape();
    shape.moveTo(0, y0);
    shape.lineTo(R * Math.cos(a0), y0);
    const n = 18;
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      shape.lineTo(R * Math.cos(a), R * Math.sin(a));
    }
    shape.lineTo(0, y1);
    shape.lineTo(0, y0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -length / 2);
    geo.rotateY(Math.PI / 2); // shape x → −z (back half), extrusion → +x
    return geo;
  }

  /** Back-half (z ≤ 0) of a vertical cylinder of radius R from y = 0 to y = h. */
  function vHalfGeo(R: number, h: number) {
    const shape = new THREE.Shape();
    shape.moveTo(R, 0);
    shape.absarc(0, 0, R, 0, Math.PI, false);
    shape.lineTo(R, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2); // shape y → −z, extrusion → +y
    return geo;
  }

  function cutMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
    const m = add(parent, new THREE.Mesh(geo, mat), x, y, z);
    cutOnly.push(m);
    return m;
  }

  // ------------------------------------------------------------- vessels
  function hVessel(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    L: number,
    R: number,
    base: THREE.MeshStandardMaterial,
    saddles = true
  ) {
    const g = add(parent, new THREE.Group(), x, y, z);
    const sm = shellMat(base, z);
    const body = add(g, new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 40, 1, true), sm));
    body.rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) {
      const head = add(
        g,
        new THREE.Mesh(new THREE.SphereGeometry(R, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), sm),
        (s * L) / 2,
        0,
        0
      );
      head.rotation.z = -s * (Math.PI / 2);
      head.scale.set(1, 0.5, 1);
    }
    if (saddles) {
      for (const s of [-1, 1]) {
        const sx = s * L * 0.3;
        const h = y - R * 0.96;
        box(g, 0.45, h, R * 1.0, MAT.steel, sx, h / 2 - y, 0);
        box(g, 0.9, 0.22, R * 1.5, MAT.concrete, sx, 0.11 - y, 0);
      }
    }
    return g;
  }

  function hLiquid(g: THREE.Object3D, R: number, x0: number, x1: number, y0: number, y1: number, mat: THREE.Material) {
    return cutMesh(g, hSlabGeo(R * 0.97, y0, y1, x1 - x0), mat, (x0 + x1) / 2, 0, 0);
  }

  function vVessel(
    parent: THREE.Object3D,
    x: number,
    z: number,
    R: number,
    H: number,
    skirt: number,
    base: THREE.MeshStandardMaterial,
    platform = true
  ) {
    const g = add(parent, new THREE.Group(), x, 0, z);
    const sm = shellMat(base, z);
    cyl(g, R, R, H, sm, 0, skirt + H / 2, 0, 40, true);
    const top = add(g, new THREE.Mesh(new THREE.SphereGeometry(R, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), sm), 0, skirt + H, 0);
    top.scale.set(1, 0.5, 1);
    const bot = add(g, new THREE.Mesh(new THREE.SphereGeometry(R, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), sm), 0, skirt, 0);
    bot.rotation.x = Math.PI;
    bot.scale.set(1, 0.5, 1);
    cyl(g, R * 0.98, R * 0.98, skirt, MAT.steel, 0, skirt / 2, 0, 32, true);
    cyl(g, R * 1.5, R * 1.5, 0.25, MAT.concrete, 0, 0.125, 0, 32);
    // ladder on the +x side
    box(g, 0.45, H + skirt - 0.4, 0.06, MAT.yellow, R + 0.3, (H + skirt) / 2 + 0.2, 0);
    if (platform) {
      const ring = add(g, new THREE.Mesh(new THREE.RingGeometry(R, R + 0.85, 36, 1), MAT.grating), 0, skirt + H - 0.15, 0);
      ring.rotation.x = -Math.PI / 2;
      const rail = torus(g, R + 0.82, 0.04, MAT.yellow, 0, skirt + H + 0.85, 0);
      rail.rotation.x = Math.PI / 2;
    }
    return g;
  }

  function vLiquid(g: THREE.Object3D, R: number, y0: number, y1: number, mat: THREE.Material) {
    return cutMesh(g, vHalfGeo(R * 0.97, y1 - y0), mat, 0, y0, 0);
  }

  function nozzle(g: THREE.Object3D, x: number, y: number, z: number, r = 0.24, len = 0.5) {
    return cyl(g, r, r, len, MAT.steel, x, y, z, 16);
  }

  function valve(parent: THREE.Object3D, x: number, y: number, z: number, along: 'x' | 'z' = 'x', s = 1) {
    const g = add(parent, new THREE.Group(), x, y, z);
    box(g, 0.55 * s, 0.42 * s, 0.42 * s, MAT.darkSteel);
    cyl(g, 0.05 * s, 0.05 * s, 0.5 * s, MAT.steel, 0, 0.42 * s, 0, 8);
    const w = torus(g, 0.22 * s, 0.04 * s, MAT.red, 0, 0.68 * s, 0);
    w.rotation.x = Math.PI / 2;
    if (along === 'z') g.rotation.y = Math.PI / 2;
    return g;
  }

  function controlValve(parent: THREE.Object3D, x: number, y: number, z: number, along: 'x' | 'z' = 'x', s = 1) {
    const g = add(parent, new THREE.Group(), x, y, z);
    box(g, 0.55 * s, 0.42 * s, 0.42 * s, MAT.darkSteel);
    cyl(g, 0.05 * s, 0.05 * s, 0.4 * s, MAT.steel, 0, 0.4 * s, 0, 8);
    cyl(g, 0.3 * s, 0.22 * s, 0.22 * s, MAT.motor, 0, 0.7 * s, 0, 20);
    if (along === 'z') g.rotation.y = Math.PI / 2;
    return g;
  }

  // ---------------------------------------------------------------- pipes
  const pipeRoot = new THREE.Group();
  scene.add(pipeRoot);
  const supportRoot = new THREE.Group();
  scene.add(supportRoot);

  function addPipe(points: V3[], stream: StreamKey | null, radius = 0.2, supports = true) {
    const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const mats = stream ? streamMats[stream] : null;
    const pipeMat = mats ? mats.pipe : MAT.idlePipe;
    const jointMat = mats ? mats.joint : MAT.idlePipe;
    let dist = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = a.distanceTo(b);
      if (len < 1e-4) continue;
      const geo = new THREE.CylinderGeometry(radius, radius, len, 14, 1, true);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setY(k, (dist + uv.getY(k) * len) / PITCH);
      const m = new THREE.Mesh(geo, pipeMat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      pipeRoot.add(m);
      dist += len;

      // supports under elevated horizontal runs
      if (supports && Math.abs(a.y - b.y) < 1e-3 && a.y > 1.2 && len > 3) {
        const n = Math.floor(len / 5);
        for (let k = 1; k <= Math.max(n, 1); k++) {
          const t = k / (Math.max(n, 1) + 1);
          const p = a.clone().lerp(b, t);
          if (p.y < 0.5) continue;
          box(supportRoot, 0.16, p.y - radius, 0.16, MAT.steel, p.x, (p.y - radius) / 2, p.z);
          box(supportRoot, 0.5, 0.12, 0.5, MAT.concrete, p.x, 0.06, p.z);
        }
      }
    }
    for (const p of pts) {
      add(pipeRoot, new THREE.Mesh(new THREE.SphereGeometry(radius * 1.04, 12, 8), jointMat), p.x, p.y, p.z);
    }
  }

  // --------------------------------------------------------- particles
  const animators: Array<(t: number, dt: number) => void> = [];
  const particleSystems: Particles[] = [];
  const particleRoot = new THREE.Group();
  scene.add(particleRoot);
  const particleGeo = new THREE.SphereGeometry(1, 8, 6);

  function addParticles(
    count: number,
    color: THREE.ColorRepresentation,
    size: number,
    min: V3,
    max: V3,
    vy: number,
    drift = 0
  ) {
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.InstancedMesh(particleGeo, mat, count);
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    const mn = new THREE.Vector3(...min);
    const mx = new THREE.Vector3(...max);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.lerp(mn.x, mx.x, Math.random());
      pos[i * 3 + 1] = THREE.MathUtils.lerp(mn.y, mx.y, Math.random());
      pos[i * 3 + 2] = THREE.MathUtils.lerp(mn.z, mx.z, Math.random());
      speed[i] = 0.6 + Math.random() * 0.8;
      dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      dummy.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.userData.noShadow = true;
    particleRoot.add(mesh);
    particleSystems.push({ mesh, pos, speed, min: mn, max: mx, vy, drift });
  }

  const tmpMat = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();
  function updateParticles(dt: number) {
    for (const ps of particleSystems) {
      const { mesh, pos, speed, min, max, vy, drift } = ps;
      for (let i = 0; i < mesh.count; i++) {
        let y = pos[i * 3 + 1] + vy * speed[i] * dt;
        let x = pos[i * 3] + drift * dt;
        if (vy > 0 && y > max.y) y = min.y;
        if (vy < 0 && y < min.y) y = max.y;
        if (x > max.x) x = min.x;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        mesh.getMatrixAt(i, tmpMat);
        tmpMat.decompose(tmpPos, tmpQuat, tmpScale);
        tmpPos.set(x, y, pos[i * 3 + 2]);
        tmpMat.compose(tmpPos, tmpQuat, tmpScale);
        mesh.setMatrixAt(i, tmpMat);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ============================================================== BUILD

  // --------------------------------------------------- ground & subsurface
  const W = X1 - X0;
  const D = Z1 - Z0;
  const CX = (X0 + X1) / 2;
  const CZ = (Z0 + Z1) / 2;
  const invisible = new THREE.MeshBasicMaterial({ visible: false });
  const soilSide = std('#7a5f42', 0, 0.95);
  const gravelTop = std('#aaa591', 0, 1);
  const topsoil = box(scene, W, 0.5, D, [soilSide, soilSide, gravelTop, invisible, soilSide, soilSide], CX, -0.25, CZ);
  topsoil.userData.ground = true;

  interface Stratum {
    y0: number;
    y1: number;
    color: string;
    opacity: number;
    reservoir: boolean;
    label: string;
  }
  const strata: Stratum[] = [
    { y0: -3.0, y1: -0.5, color: '#b48a5a', opacity: 0.5, reservoir: false, label: 'Overburden' },
    { y0: -3.8, y1: -3.0, color: '#5d6168', opacity: 0.55, reservoir: false, label: 'Cap rock (seal)' },
    { y0: -4.6, y1: -3.8, color: '#ecd37a', opacity: 0.42, reservoir: true, label: 'Gas cap' },
    { y0: -6.4, y1: -4.6, color: '#7a4a1a', opacity: 0.45, reservoir: true, label: 'Oil zone' },
    { y0: -8.4, y1: -6.4, color: '#2f6fae', opacity: 0.42, reservoir: true, label: 'Aquifer (water)' },
  ];
  const strataMats: Array<{ mat: THREE.MeshStandardMaterial; opacity: number }> = [];
  const annotations: CSS2DObject[] = [];
  const undergroundAnnotations: CSS2DObject[] = [];
  strata.forEach((s, i) => {
    const side = std(s.color, 0, 0.9, { transparent: true, opacity: s.opacity, depthWrite: false });
    strataMats.push({ mat: side, opacity: s.opacity });
    const bottom = i === strata.length - 1 ? side : invisible;
    const parent = s.reservoir ? eqGroup('reservoir') : scene;
    const m = box(parent, W, s.y1 - s.y0, D, [side, side, invisible, bottom, side, side], CX, (s.y0 + s.y1) / 2, CZ);
    m.userData.noShadow = true;
    m.renderOrder = 2; // after pipes so underground tubing is tinted by the layers in front of it
    const a = annotation(s.label, 'plant-annot plant-annot-strata');
    a.position.set(X0 + 9 + i * 11, (s.y0 + s.y1) / 2, Z1 + 0.05); // staggered so thin layers don't overlap
    scene.add(a);
    undergroundAnnotations.push(a);
  });

  // road along the front
  box(scene, W, 0.06, 2.4, MAT.asphalt, CX, 0.03, 15.8);

  // ------------------------------------------------- 2 · wells
  function christmasTree(parent: THREE.Object3D, x: number, z: number, wingDir = 1) {
    const g = add(parent, new THREE.Group(), x, 0, z);
    box(g, 3.2, 0.14, 3.2, MAT.concrete, 0, 0.07, 0);
    cyl(g, 0.5, 0.55, 0.5, MAT.darkSteel, 0, 0.35, 0);
    cyl(g, 0.38, 0.38, 0.4, MAT.steel, 0, 0.8, 0);
    for (const yy of [1.2, 1.75]) {
      box(g, 0.55, 0.42, 0.55, MAT.steel, 0, yy, 0);
      const w = torus(g, 0.26, 0.045, MAT.red, 0, yy, 0.48);
      w.rotation.y = 0;
      zcyl(g, 0.05, 0.2, MAT.steel, 0, yy, 0.36, 8);
    }
    box(g, 0.55, 0.5, 0.55, MAT.steel, 0, 2.3, 0);
    // wing valve and choke
    box(g, 0.42, 0.42, 0.42, MAT.steel, 0.75 * wingDir, 2.3, 0);
    torus(g, 0.22, 0.04, MAT.red, 0.75 * wingDir, 2.3, 0.4);
    box(g, 0.36, 0.36, 0.36, MAT.darkSteel, 1.15 * wingDir, 2.3, 0);
    cyl(g, 0.1, 0.1, 0.3, MAT.steel, 1.15 * wingDir, 2.6, 0, 8);
    // swab valve, cap and gauge
    box(g, 0.42, 0.42, 0.42, MAT.steel, 0, 2.85, 0);
    torus(g, 0.22, 0.04, MAT.red, 0, 2.85, 0.4);
    cyl(g, 0.22, 0.22, 0.35, MAT.steel, 0, 3.25, 0, 16);
    cyl(g, 0.04, 0.04, 0.3, MAT.steel, 0, 3.55, 0, 6);
    const gauge = zcyl(g, 0.14, 0.06, MAT.building, 0, 3.75, 0, 16);
    gauge.rotation.x = Math.PI / 2;
    return g;
  }

  const WX = -38;
  const wellZ = [-7, 0, 7];
  {
    const g = eqGroup('wells');
    wellZ.forEach((z) => {
      christmasTree(g, WX, z);
      // underground tubing (well fluid flowing up)
      for (let k = 0; k < 4; k++) {
        const r = torus(g, 0.3, 0.05, MAT.perfOil, WX, -5.2 - k * 0.3, z);
        r.rotation.x = Math.PI / 2;
        r.userData.noShadow = true;
      }
      // casing (thin, dark) around the tubing
      const casing = cyl(g, 0.24, 0.24, 5.9, std('#4b5563', 0.4, 0.5, { transparent: true, opacity: 0.35, depthWrite: false }), WX, -3.05, z, 16, true);
      casing.userData.noShadow = true;
    });
    // well numbers
    wellZ.forEach((z, i) => {
      const a = annotation(`Well ${i + 1}`, 'plant-annot');
      a.position.set(WX - 1.6, 1.2, z);
      g.add(a);
      annotations.push(a);
    });
  }
  // well streams: tubing + flowline into the manifold
  wellZ.forEach((z, i) => {
    addPipe([[WX, -6.0, z], [WX, 2.3, z]], 'well', 0.13, false);
    if (i === 2) {
      // well 3 is lined up to the test header
      addPipe([[WX, 2.3, z], [WX + 1.5, 2.3, z], [WX + 1.5, 0.8, z], [-30.6, 0.8, z], [-30.6, 1.7, z], [-30.6, 1.7, 10], [-25, 1.7, 10], [-23.9, 1.7, 10]], 'well', 0.17);
    } else if (i === 0) {
      addPipe([[WX, 2.3, z], [WX + 1.5, 2.3, z], [WX + 1.5, 0.8, z], [-30, 0.8, z], [-30, 0.8, 0]], 'well', 0.17);
    } else {
      addPipe([[WX, 2.3, z], [WX + 1.5, 2.3, z], [WX + 1.5, 0.8, z], [-30, 0.8, z]], 'well', 0.17);
    }
  });

  // ------------------------------------------------- 3 · manifold
  {
    const g = eqGroup('manifold');
    box(g, 2.6, 0.2, 17.6, MAT.concrete, -30.3, 0.1, 0);
    // idle header sections (grey = no flow right now)
    addPipe([[-30, 0.8, 0], [-30, 0.8, 7.6]], null, 0.17, false);
    addPipe([[-30.6, 1.7, -7.6], [-30.6, 1.7, 7]], null, 0.15, false);
    addPipe([[-30.6, 0.8, 7], [-30, 0.8, 7]], null, 0.15, false);
    wellZ.forEach((z, i) => {
      if (i < 2) addPipe([[-30.6, 0.8, z], [-30.6, 1.7, z]], null, 0.12, false);
      valve(g, -31.4, 0.8, z, 'x', 0.75);
      valve(g, -30.6, 1.25, z + 0.35, 'z', 0.55);
    });
    for (const z of [-7.6, 7.6]) box(g, 0.2, 1.7, 0.2, MAT.steel, -30.3, 0.85, z);
  }

  // ------------------------------------------------- 4 · test separator
  {
    const g = eqGroup('test-separator');
    const v = hVessel(g, -21.5, 1.7, 10, 4, 0.8, MAT.vessel);
    hLiquid(v, 0.8, -2, 2, -0.8, -0.32, MAT.water);
    hLiquid(v, 0.8, -2, 2, -0.32, 0.05, MAT.oil);
    // meter runs on top (gas, oil, water)
    [-1.1, 0, 1.1].forEach((dx, k) => {
      const col = [STREAMS.gas.color, STREAMS.oil.color, STREAMS.water.color][k];
      box(g, 0.5, 0.36, 0.36, std(col, 0.3, 0.5), -21.5 + dx, 2.8, 10 - 0.2);
      cyl(g, 0.06, 0.06, 0.3, MAT.steel, -21.5 + dx, 2.5, 10 - 0.2, 8);
    });
    box(g, 6, 0.16, 2.4, MAT.concrete, -21.5, 0.08, 10);
  }
  addPipe([[-19.1, 1.7, 10], [-15.5, 1.7, 10], [-15.5, 1.7, 0]], 'well', 0.17);

  // ------------------------------------------------- 5 · inlet heater
  {
    const g = eqGroup('inlet-heater');
    const v = hVessel(g, -21, 1.7, 0, 5, 1.1, MAT.vesselWarm);
    // water bath (translucent so the tubes show)
    cutMesh(v, hSlabGeo(1.1 * 0.96, -1.1, 0.62, 5), MAT.bath);
    // U-shaped fire tube (low) and process coil (high), both in the back half
    const ft1 = xcyl(v, 0.24, 4.3, MAT.fireTube, -0.3, -0.62, -0.42, 16);
    const ft2 = xcyl(v, 0.2, 4.0, MAT.fireTube, -0.15, -0.15, -0.55, 16);
    cutOnly.push(ft1, ft2);
    for (let k = 0; k < 3; k++) {
      const c = xcyl(v, 0.07, 4.2, streamMats.well.joint, 0, 0.18 + k * 0.14, -0.3 - k * 0.12, 8);
      cutOnly.push(c);
    }
    // burner housing on the left head, stack on the right
    box(g, 0.8, 0.9, 1.1, MAT.darkSteel, -24.6, 1.3, 0);
    cyl(g, 0.28, 0.28, 6.0, MAT.darkSteel, -19.4, 5.7, 0, 16);
    cyl(g, 0.45, 0.3, 0.25, MAT.darkSteel, -19.4, 8.85, 0, 16);
    box(g, 7.4, 0.16, 3.0, MAT.concrete, -21.2, 0.08, 0);
  }
  addPipe([[-30, 0.8, 0], [-25.6, 0.8, 0], [-25.6, 3.4, 0], [-23.2, 3.4, 0], [-23.2, 2.75, 0]], 'well', 0.2);
  addPipe([[-17.95, 1.7, 0], [-15.5, 1.7, 0], [-15.5, 4.7, 0], [-12.8, 4.7, 0], [-12.8, 3.85, 0]], 'well', 0.2);

  // ------------------------------------------------- 6 · HP separator
  {
    const g = eqGroup('hp-separator');
    const R = 1.5;
    const v = hVessel(g, -9, 2.4, 0, 9, R, MAT.vessel);
    hLiquid(v, R, -4.5, 2.6, -R, -0.5, MAT.water);
    hLiquid(v, R, -4.5, 2.6, -0.5, 0.2, MAT.oil);
    cutMesh(v, hSlabGeo(R * 0.97, -R, 0.05, 0.1), MAT.steel, 2.65, 0, 0); // weir plate
    hLiquid(v, R, 2.7, 4.5, -R, -0.35, MAT.oil); // oil bucket
    cutMesh(v, new THREE.BoxGeometry(0.1, 1.1, 1.15), MAT.steel, -3.6, 0.55, -0.6); // inlet diverter
    cutMesh(v, new THREE.BoxGeometry(0.75, 0.42, 1.0), MAT.meshPad, 3.6, 0.95, -0.55); // mist pad
    nozzle(v, -3.8, R + 0.15, 0);
    nozzle(v, 3.6, R + 0.15, 0);
    nozzle(v, 0, R + 0.15, 0, 0.18);
    nozzle(v, 3.8, -R - 0.15, 0, 0.2);
    nozzle(v, 1.0, -R - 0.15, 0, 0.2);
    // pressure safety valve on top
    box(v, 0.4, 0.5, 0.4, MAT.red, 0, R + 0.6, 0);
    controlValve(g, -3.7, 0.45, 0, 'x', 0.6); // oil level control valve
    controlValve(g, -8.0, 0.45, 5.0, 'z', 0.6); // water (interface) level control valve
    controlValve(g, -5.4, 6.2, -4, 'z', 0.6); // pressure control valve on the gas outlet
    // cross-section particles (drawn on the cut face)
    const cx = -9;
    const cy = 2.4;
    addParticles(26, '#3d8bfd', 0.06, [cx - 4.1, cy - 0.45, 0.03], [cx + 2.4, cy + 0.15, 0.05], -0.18, 0.25);
    addParticles(30, '#f8fafc', 0.05, [cx - 4.1, cy - 1.3, 0.03], [cx + 2.4, cy + 0.17, 0.05], 0.5, 0.25);
    addParticles(18, '#b0661f', 0.055, [cx - 4.1, cy - 1.3, 0.03], [cx + 2.4, cy - 0.55, 0.05], 0.14, 0.25);
  }

  // ------------------------------------------------- 7 · LP separator
  {
    const g = eqGroup('lp-separator');
    const R = 1.2;
    const v = hVessel(g, 3, 2.0, 0, 7, R, MAT.vessel);
    hLiquid(v, R, -3.5, 3.5, -R, -0.05, MAT.oil);
    cutMesh(v, new THREE.BoxGeometry(0.1, 0.9, 0.9), MAT.steel, -2.8, 0.45, -0.48);
    cutMesh(v, new THREE.BoxGeometry(0.65, 0.34, 0.8), MAT.meshPad, 2.4, 0.75, -0.45);
    nozzle(v, 2.4, R + 0.15, 0);
    nozzle(v, 0, R + 0.15, 0, 0.16);
    nozzle(v, 3.0, -R - 0.15, 0, 0.2);
    box(v, 0.36, 0.45, 0.36, MAT.red, 0, R + 0.55, 0);
    controlValve(g, 7.1, 0.45, 0, 'x', 0.55);
    addParticles(26, '#f8fafc', 0.05, [0, 1.0, 0.03], [6, 1.95, 0.05], 0.45, 0.2);
  }
  // HP oil → LP, LP oil → treater
  addPipe([[-5.2, 0.9, 0], [-5.2, 0.45, 0], [-2.2, 0.45, 0], [-2.2, 2.0, 0], [-1.1, 2.0, 0]], 'oil', 0.18);
  addPipe([[6.0, 0.8, 0], [6.0, 0.45, 0], [8.2, 0.45, 0], [8.2, 2.2, 0], [9.3, 2.2, 0]], 'oil', 0.18);

  // ------------------------------------------------- 8 · treater
  {
    const g = eqGroup('treater');
    const R = 1.4;
    const v = hVessel(g, 14, 2.2, 0, 8, R, MAT.vessel);
    hLiquid(v, R, -4, 4, -R, -0.75, MAT.water);
    hLiquid(v, R, -4, 4, -0.75, 1.15, MAT.oil);
    const electrodes: THREE.Mesh[] = [];
    for (const yy of [0.15, 0.6]) {
      const half = Math.sqrt(R * R - yy * yy) * 0.95;
      const e = cutMesh(v, new THREE.BoxGeometry(5.2, 0.07, half + 0.04), MAT.electrode, 0, yy, -half / 2 + 0.02);
      e.userData.noShadow = true;
      electrodes.push(e);
    }
    // transformer and bushings on top
    box(v, 1.3, 0.9, 1.1, MAT.darkSteel, 0, R + 0.45, 0);
    for (const dx of [-0.35, 0.35]) cyl(v, 0.09, 0.12, 0.5, MAT.building, dx, R + 1.15, 0, 10);
    nozzle(v, 3.0, R + 0.15, 0);
    nozzle(v, -2.4, -R - 0.15, 0, 0.2);
    addParticles(36, '#4a95ff', 0.08, [10.6, 1.55, 0.03], [17.4, 3.25, 0.05], -0.3, 0.12);
    animators.push((t) => {
      MAT.electrode.emissiveIntensity = 0.9 + 0.5 * Math.abs(Math.sin(t * 9)) * Math.random();
    });
  }
  // treated oil → stabilizer feed
  addPipe([[17, 3.6, 0], [17, 5.0, 0], [22.5, 5.0, 0], [22.5, 9.5, 0], [22.5, 9.5, -2.6]], 'oil', 0.18);

  // ------------------------------------------------- 9 · stabilizer
  {
    const g = eqGroup('stabilizer');
    const R = 0.9;
    const skirt = 1.5;
    const H = 11;
    const v = vVessel(g, 22.5, -3.5, R, H, skirt, MAT.column);
    for (let y = skirt + 1.2; y < skirt + H - 0.4; y += 0.75) {
      cutMesh(v, vHalfGeo(R * 0.96, 0.06), MAT.steel, 0, y, 0);
      cutMesh(v, new THREE.BoxGeometry(0.06, 0.45, R * 0.9), MAT.steel, (Math.round(y / 0.75) % 2 ? 1 : -1) * R * 0.55, y + 0.25, -R * 0.45);
    }
    vLiquid(v, R, skirt - 0.2, skirt + 0.8, MAT.oil);
    // reboiler behind the column
    const rb = hVessel(g, 22.5, 1.2, -6.4, 2.2, 0.5, MAT.vesselWarm);
    rb.userData.noCut = true;
    addPipe([[22.5, 1.8, -4.35], [22.5, 1.8, -5.9]], null, 0.12, false);
    addPipe([[21.9, 1.0, -4.3], [21.9, 1.0, -5.95]], null, 0.12, false);
  }
  // overhead vapour → compressor suction
  addPipe([[22.5, 13.0, -3.5], [22.5, 13.8, -3.5], [22.5, 13.8, -7.6], [14.6, 13.8, -7.6], [14.6, 7.0, -7.6], [14.6, 7.0, -11]], 'gas', 0.15);
  // bottoms → tanks
  addPipe([[23.4, 1.3, -3.5], [26, 1.3, -3.5], [26, 1.3, -4.5], [28.3, 1.3, -4.5]], 'oil', 0.18);
  addPipe([[26, 1.3, -3.5], [26, 1.3, 4.5], [28.3, 1.3, 4.5]], 'oil', 0.18);

  // ------------------------------------------------- 10 · storage tanks
  {
    const g = eqGroup('storage');
    const R = 3.2;
    const H = 5.5;
    const level = 3.4;
    for (const z of [-4.5, 4.5]) {
      const t = add(g, new THREE.Group(), 31.5, 0, z);
      const sm = shellMat(MAT.tank, z);
      cyl(t, R, R, H, sm, 0, H / 2 + 0.2, 0, 48, true);
      cyl(t, R + 0.15, R + 0.15, 0.2, MAT.concrete, 0, 0.1, 0, 48);
      cyl(t, R, R, 0.04, MAT.steel, 0, 0.22, 0, 48);
      const girder = torus(t, R + 0.05, 0.08, MAT.steel, 0, H + 0.1, 0);
      girder.rotation.x = Math.PI / 2;
      // oil inventory and floating roof (full when closed, half in cutaway)
      const fullOil = cyl(t, R * 0.98, R * 0.98, level, MAT.oil, 0, 0.22 + level / 2, 0, 48);
      const fullRoof = cyl(t, R * 0.96, R * 0.96, 0.25, MAT.steel, 0, 0.22 + level + 0.12, 0, 48);
      solidOnly.push(fullOil, fullRoof);
      cutMesh(t, vHalfGeo(R * 0.98, level), MAT.oil, 0, 0.22, 0);
      cutMesh(t, vHalfGeo(R * 0.96, 0.25), MAT.steel, 0, 0.22 + level, 0);
      // ladder
      box(t, 0.5, H, 0.06, MAT.yellow, R + 0.25, H / 2 + 0.2, 0);
    }
    // bund wall
    const bx0 = 27.6;
    const bx1 = 35.4;
    const bz = 8.6;
    box(g, bx1 - bx0, 0.6, 0.25, MAT.concrete, (bx0 + bx1) / 2, 0.3, -bz);
    box(g, bx1 - bx0, 0.6, 0.25, MAT.concrete, (bx0 + bx1) / 2, 0.3, bz);
    box(g, 0.25, 0.6, 2 * bz, MAT.concrete, bx0, 0.3, 0);
    box(g, 0.25, 0.6, 2 * bz, MAT.concrete, bx1, 0.3, 0);
  }
  addPipe([[34.7, 1.0, -4.5], [36, 1.0, -4.5], [36, 1.0, 0], [47, 1.0, 0], [47, -1.5, 0], [48.7, -1.5, 0]], 'oil', 0.2);
  addPipe([[34.7, 1.0, 4.5], [36, 1.0, 4.5], [36, 1.0, 0]], 'oil', 0.2);

  // ------------------------------------------------- 11 · export pumps & metering
  {
    const g = eqGroup('export');
    box(g, 9.4, 0.25, 3.4, MAT.concrete, 41.4, 0.125, 0);
    // two pumps inline, motors to the side
    for (const px of [37.6, 39.0]) {
      zcyl(g, 0.5, 0.55, MAT.pump, px, 1.0, 0, 20);
      zcyl(g, 0.15, 0.6, MAT.steel, px, 1.0, 0.75, 10);
      zcyl(g, 0.42, 1.3, MAT.motor, px, 1.0, 1.55, 20);
      box(g, 0.9, 0.5, 2.6, MAT.steel, px, 0.5, 0.9);
    }
    // meter run with transmitters and a prover loop behind
    xcyl(g, 0.32, 3.0, MAT.steel, 41.6, 1.0, 0, 20);
    for (const mx of [40.8, 42.4]) {
      box(g, 0.25, 0.35, 0.25, MAT.building, mx, 1.55, 0);
      cyl(g, 0.04, 0.04, 0.25, MAT.steel, mx, 1.3, 0, 6);
    }
    addPipe([[40.2, 1.0, -0.4], [40.2, 1.0, -1.3], [43.0, 1.0, -1.3], [43.0, 1.0, -0.4]], null, 0.14, false);
    box(g, 0.7, 1.2, 0.7, MAT.building, 43.6, 0.85, 1.1); // sampler cabinet
    // pig launcher
    xcyl(g, 0.42, 1.6, MAT.darkSteel, 45.3, 1.0, 0, 20);
    xcyl(g, 0.46, 0.08, MAT.red, 44.48, 1.0, 0, 20);
  }
  {
    const a = annotation('→ Crude export pipeline', 'plant-annot');
    a.position.set(X1 + 1.2, -1.5, 0);
    scene.add(a);
    annotations.push(a);
  }

  // ------------------------------------------------- 12 · scrubber
  {
    const g = eqGroup('scrubber');
    const R = 0.9;
    const skirt = 1.2;
    const H = 4.5;
    const v = vVessel(g, 8, -11, R, H, skirt, MAT.vessel);
    cutMesh(v, vHalfGeo(R * 0.96, 0.32), MAT.meshPad, 0, skirt + H - 0.8, 0);
    vLiquid(v, R, skirt - 0.3, skirt + 0.6, MAT.oil);
    cutMesh(v, new THREE.BoxGeometry(0.9, 0.08, 0.6), MAT.steel, 0, skirt + 2.75, -0.3);
    addParticles(16, '#b0661f', 0.05, [7.3, skirt + 0.65, -11 + 0.03], [8.7, skirt + 2.7, -11 + 0.05], -0.6);
  }
  // HP + LP gas → scrubber
  addPipe([[-5.4, 3.9, 0], [-5.4, 6.2, 0], [-5.4, 6.2, -8], [8, 6.2, -8], [8, 4.0, -8], [8, 4.0, -10.1]], 'gas', 0.22);
  addPipe([[5.4, 3.2, 0], [5.4, 6.2, 0], [5.4, 6.2, -8]], 'gas', 0.18);
  // scrubber → compressor suction
  addPipe([[8, 6.15, -11], [8, 7.0, -11], [14.6, 7.0, -11], [14.6, 2.3, -11]], 'gas', 0.22);

  // ------------------------------------------------- 13 · compressor + fin-fan cooler
  const fans: THREE.Object3D[] = [];
  {
    const g = eqGroup('compressor');
    box(g, 7.2, 0.3, 3.6, MAT.concrete, 13.9, 0.15, -11);
    box(g, 6.6, 0.25, 3.0, MAT.steel, 13.9, 0.42, -11);
    xcyl(g, 0.85, 2.2, MAT.motor, 11.9, 1.4, -11, 28); // driver
    box(g, 2.0, 1.2, 1.5, MAT.motor, 11.9, 1.0, -11);
    xcyl(g, 0.3, 0.8, MAT.yellow, 13.4, 1.4, -11, 16); // coupling guard
    xcyl(g, 0.95, 2.4, std('#5f7180', 0.5, 0.4), 15.0, 1.45, -11, 28); // compressor casing
    nozzle(g, 14.6, 2.45, -11, 0.26, 0.4);
    nozzle(g, 16.2, 2.45, -11, 0.26, 0.4);
    box(g, 1.2, 1.0, 1.0, MAT.darkSteel, 16.6, 0.9, -12.6); // lube oil console
    // cooler (elevated) between compressor and contactor
    const cx = 19;
    const cz = -11;
    for (const dx of [-1.4, 1.4]) for (const dz of [-1.6, 1.6]) box(g, 0.18, 3.9, 0.18, MAT.steel, cx + dx, 1.95, cz + dz);
    box(g, 3.0, 0.5, 3.4, std('#8d969f', 0.6, 0.45), cx, 4.15, cz); // tube bundle
    for (const dx of [-1.6, 1.6]) box(g, 0.35, 0.75, 3.4, MAT.darkSteel, cx + dx, 4.15, cz);
    for (const dz of [-0.85, 0.85]) {
      const ring = torus(g, 0.72, 0.06, MAT.darkSteel, cx, 4.55, cz + dz);
      ring.rotation.x = Math.PI / 2;
      const fan = add(g, new THREE.Group(), cx, 4.55, cz + dz);
      cyl(fan, 0.12, 0.12, 0.12, MAT.darkSteel, 0, 0, 0, 10);
      for (let b = 0; b < 4; b++) {
        const blade = box(fan, 1.3, 0.03, 0.2, MAT.steel, 0, 0, 0);
        blade.rotation.y = (b * Math.PI) / 4;
        blade.rotation.x = 0.25;
      }
      fans.push(fan);
    }
  }
  addPipe([[16.2, 2.3, -11], [16.2, 4.15, -11], [17.4, 4.15, -11], [20.6, 4.15, -11], [21.6, 4.15, -11], [21.6, 1.9, -11], [22.7, 1.9, -11]], 'gas', 0.2);

  // ------------------------------------------------- 14 · TEG dehydration
  {
    const g = eqGroup('dehydration');
    const R = 0.8;
    const skirt = 1.4;
    const H = 9.5;
    const v = vVessel(g, 23.5, -11, R, H, skirt, MAT.column);
    for (let y = skirt + 1.6; y < skirt + H - 0.6; y += 0.6) {
      cutMesh(v, vHalfGeo(R * 0.96, 0.08), MAT.glycol, 0, y, 0);
    }
    cutMesh(v, vHalfGeo(R * 0.96, 0.3), MAT.meshPad, 0, skirt + H - 0.4, 0);
    addParticles(24, '#fde68a', 0.045, [22.9, skirt + 0.6, -11 + 0.03], [24.1, skirt + H - 0.6, -11 + 0.05], 0.9);
    // glycol regeneration skid behind
    box(g, 6.2, 0.2, 2.6, MAT.concrete, 28.6, 0.1, -14.2);
    const reb = hVessel(g, 28.3, 1.2, -13.5, 3.0, 0.6, MAT.vesselWarm);
    reb.userData.noCut = true;
    cyl(g, 0.28, 0.28, 2.2, MAT.column, 26.9, 2.9, -13.5, 16); // still column
    cyl(g, 0.18, 0.18, 2.4, MAT.darkSteel, 29.4, 3.0, -13.5, 12); // fire-tube stack
    box(g, 0.8, 0.6, 0.6, MAT.pump, 30.6, 0.5, -14.6); // glycol pump
  }
  addPipe([[23.5, 2.6, -11.8], [23.5, 2.6, -13.5], [26.6, 2.6, -13.5]], 'glycol', 0.1, false);
  addPipe([[29.8, 1.2, -13.5], [30.6, 1.2, -13.5], [30.6, 10.2, -13.5], [23.5, 10.2, -13.5], [23.5, 10.2, -11.8]], 'glycol', 0.1);
  // dry gas → metering → sales pipeline
  addPipe([[23.5, 11.3, -11], [23.5, 12.0, -11], [25.4, 12.0, -11], [25.4, 1.0, -11], [47, 1.0, -11], [47, -1.5, -11], [48.7, -1.5, -11]], 'gas', 0.2);

  // ------------------------------------------------- 15 · gas export metering
  {
    const g = eqGroup('gas-export');
    box(g, 7, 0.25, 2.8, MAT.concrete, 36, 0.125, -11);
    xcyl(g, 0.34, 3.4, MAT.steel, 35.4, 1.0, -11, 20);
    for (const mx of [34.6, 36.2]) {
      box(g, 0.25, 0.35, 0.25, MAT.building, mx, 1.55, -11);
      cyl(g, 0.04, 0.04, 0.25, MAT.steel, mx, 1.3, -11, 6);
    }
    controlValve(g, 38.2, 1.0, -11, 'x', 0.8);
    // analyser shelter
    box(g, 1.8, 2.2, 1.8, MAT.building, 38.6, 1.35, -13.4);
    box(g, 2.0, 0.12, 2.0, MAT.roof, 38.6, 2.5, -13.4);
    box(g, 0.7, 1.4, 0.05, MAT.darkSteel, 38.6, 1.0, -12.48);
  }
  {
    const a = annotation('→ Sales-gas pipeline', 'plant-annot');
    a.position.set(X1 + 1.2, -1.5, -11);
    scene.add(a);
    annotations.push(a);
  }

  // ------------------------------------------------- 16 · flare
  let flame: THREE.Group;
  let flameLight: THREE.PointLight;
  {
    const g = eqGroup('flare');
    const kd = hVessel(g, -22, 1.3, -14, 4, 0.9, MAT.vessel);
    kd.userData.noCut = true;
    const sx = -30;
    const sz = -14;
    const top = 18;
    cyl(g, 1.2, 1.2, 0.3, MAT.concrete, sx, 0.15, sz, 24);
    cyl(g, 0.42, 0.5, top, MAT.darkSteel, sx, top / 2, sz, 20);
    cyl(g, 0.55, 0.45, 1.0, MAT.steel, sx, top + 0.5, sz, 20); // tip
    torus(g, 0.75, 0.05, MAT.steel, sx, top + 0.7, sz).rotation.x = Math.PI / 2; // windshield ring
    // guy wires
    const wireMat = new THREE.LineBasicMaterial({ color: 0x6b7280 });
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + 0.4;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(sx, top * 0.7, sz),
        new THREE.Vector3(sx + Math.cos(a) * 7, 0.05, sz + Math.sin(a) * 3.6),
      ]);
      g.add(new THREE.Line(geo, wireMat));
    }
    flame = add(g, new THREE.Group(), sx, top + 1.0, sz);
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.2, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ff6a00', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })
    );
    outer.position.y = 2.1;
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 2.6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
    );
    inner.position.y = 1.3;
    inner.renderOrder = 1;
    outer.userData.noShadow = true;
    inner.userData.noShadow = true;
    flame.add(outer, inner);
    flame.rotation.z = -0.22;
    flameLight = new THREE.PointLight('#ff8a3d', 60, 45, 1.4);
    flameLight.position.set(sx, top + 2.5, sz);
    g.add(flameLight);
  }
  // relief headers → KO drum → stack
  addPipe([[-9, 4.05, 0], [-9, 7.4, 0], [-9, 7.4, -14], [-20.5, 7.4, -14], [-20.5, 2.2, -14]], 'flare', 0.26);
  addPipe([[3, 3.25, 0], [3, 7.4, 0], [-9, 7.4, 0]], 'flare', 0.2);
  addPipe([[-24.45, 1.3, -14], [-29.5, 1.3, -14]], 'flare', 0.26, false);

  // ------------------------------------------------- 17 · hydrocyclones
  {
    const g = eqGroup('hydrocyclone');
    box(g, 5.6, 0.25, 2.4, MAT.concrete, -1, 0.125, 11);
    box(g, 4.6, 0.2, 1.6, MAT.steel, -1, 0.35, 11);
    const v = hVessel(g, -1, 1.3, 11, 3.6, 0.55, MAT.vessel);
    for (const [yy, zz] of [
      [0.18, -0.2],
      [-0.18, -0.2],
      [0, -0.36],
    ] as Array<[number, number]>) {
      const liner = cutMesh(v, new THREE.CylinderGeometry(0.11, 0.03, 3.2, 12), std('#c7ccd2', 0.5, 0.4), 0, yy, zz);
      liner.rotation.z = Math.PI / 2;
    }
    // oil reject line on top
    nozzle(v, 1.4, 0.7, 0, 0.08, 0.35);
  }
  addPipe([[-8.0, 0.9, 0], [-8.0, 0.45, 0], [-8.0, 0.45, 11], [-3.9, 0.45, 11], [-3.9, 1.3, 11], [-3.07, 1.3, 11]], 'water', 0.18);
  addPipe([[1.07, 1.3, 11], [5.25, 1.3, 11]], 'water', 0.18);

  // ------------------------------------------------- 18 · flotation (IGF)
  const rotors: THREE.Object3D[] = [];
  {
    const g = eqGroup('flotation');
    const x0 = 5.25;
    const x1 = 10.75;
    const zc = 11;
    box(g, 6.2, 0.25, 3.4, MAT.concrete, 8, 0.125, zc);
    const sm = shellMat(MAT.vessel, zc);
    box(g, x1 - x0, 2.0, 2.8, sm, 8, 1.3, zc);
    // contents (back half)
    const igfWater = std('#2f7fd6', 0.05, 0.2, { transparent: true, opacity: 0.5, depthWrite: false });
    cutMesh(g, new THREE.BoxGeometry(5.36, 1.35, 1.34), igfWater, 8, 0.3 + 0.05 + 0.675, zc - 0.68).userData.noShadow = true;
    cutMesh(g, new THREE.BoxGeometry(5.36, 0.18, 1.34), MAT.froth, 8, 1.79, zc - 0.68);
    for (const bx of [6.6, 8.0, 9.4]) cutMesh(g, new THREE.BoxGeometry(0.05, 1.5, 1.34), MAT.steel, bx, 1.1, zc - 0.68);
    for (const mx of [5.9, 7.3, 8.7, 10.1]) {
      cyl(g, 0.24, 0.24, 0.6, MAT.motor, mx, 2.6, zc - 0.5, 16);
      const shaft = cyl(g, 0.04, 0.04, 1.6, MAT.steel, mx, 1.4, zc - 0.5, 6);
      cutOnly.push(shaft);
      const rotor = add(g, new THREE.Group(), mx, 0.75, zc - 0.5);
      for (let b = 0; b < 3; b++) {
        const blade = box(rotor, 0.5, 0.12, 0.08, MAT.steel);
        blade.rotation.y = (b * Math.PI) / 3;
      }
      cutOnly.push(rotor);
      rotors.push(rotor);
    }
    box(g, 5.4, 0.25, 0.3, MAT.steel, 8, 2.15, zc - 1.1); // skimmer trough
    addParticles(60, '#f8fafc', 0.045, [x0 + 0.15, 0.45, zc + 0.03], [x1 - 0.15, 1.72, zc + 0.05], 0.55);
    addParticles(14, '#b0661f', 0.05, [x0 + 0.15, 0.6, zc + 0.03], [x1 - 0.15, 1.72, zc + 0.05], 0.35);
  }
  addPipe([[11.6, 0.8, 0], [11.6, 0.45, 0], [11.6, 0.45, 8.6], [5.8, 0.45, 8.6], [5.8, 0.45, 9.6]], 'water', 0.15);
  addPipe([[10.75, 0.9, 11], [16.2, 0.9, 11]], 'water', 0.18);

  // ------------------------------------------------- 19 · water injection
  {
    const g = eqGroup('injection');
    box(g, 5.8, 0.25, 2.4, MAT.concrete, 18.6, 0.125, 11);
    xcyl(g, 0.45, 2.6, MAT.pump, 17.5, 0.9, 11, 20);
    for (let k = 0; k < 5; k++) torus(g, 0.47, 0.04, MAT.steel, 16.4 + k * 0.55, 0.9, 11).rotation.y = Math.PI / 2;
    xcyl(g, 0.22, 0.5, MAT.yellow, 19.1, 0.9, 11, 12);
    xcyl(g, 0.52, 1.9, MAT.motor, 20.3, 0.95, 11, 24);
    box(g, 4.6, 0.4, 1.0, MAT.steel, 18.6, 0.45, 11);
    nozzle(g, 17.4, 1.45, 11, 0.16, 0.3);
    controlValve(g, 21.6, 2.3, 13, 'x', 0.6);
    // injection wellhead
    christmasTree(g, 25, 13, -1);
    for (let k = 0; k < 4; k++) {
      const r = torus(g, 0.3, 0.05, MAT.perfWater, 25, -6.9 - k * 0.3, 13);
      r.rotation.x = Math.PI / 2;
    }
    const a = annotation('Injection well', 'plant-annot');
    a.position.set(26.4, 1.2, 13);
    g.add(a);
    annotations.push(a);
  }
  addPipe([[17.4, 1.5, 11], [17.4, 2.3, 11], [17.4, 2.3, 13], [23.85, 2.3, 13]], 'water', 0.16);
  addPipe([[25, 2.3, 13], [25, -7.8, 13]], 'water', 0.13, false);

  // ------------------------------------------------- 20 · control room
  let sock: THREE.Object3D;
  {
    const g = eqGroup('control-room');
    const bx = 40.5;
    const bz = 11.5;
    box(g, 7.6, 0.2, 4.6, MAT.concrete, bx, 0.1, bz);
    box(g, 7, 3.0, 4, MAT.building, bx, 1.7, bz);
    box(g, 7.4, 0.22, 4.4, MAT.roof, bx, 3.3, bz);
    box(g, 5.6, 0.9, 0.05, MAT.window, bx + 0.4, 2.1, bz + 2.01);
    box(g, 1.0, 2.0, 0.06, MAT.darkSteel, bx - 2.8, 1.2, bz + 2.01);
    box(g, 1.2, 0.6, 0.9, MAT.steel, bx + 1.8, 3.7, bz - 0.8);
    box(g, 1.2, 0.6, 0.9, MAT.steel, bx - 0.4, 3.7, bz - 0.8);
    cyl(g, 0.05, 0.05, 4, MAT.steel, bx - 3.0, 5.4, bz - 1.4, 6);
    const dish = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), MAT.building), bx - 3.0, 6.6, bz - 1.4);
    dish.rotation.x = -Math.PI / 2.4;
    // windsock
    cyl(g, 0.05, 0.05, 6, MAT.steel, bx + 4.6, 3.0, bz + 1.6, 6);
    sock = add(g, new THREE.Group(), bx + 4.6, 5.9, bz + 1.6);
    const cone = add(sock, new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 12, 1, true), MAT.sock), 0.7, 0, 0);
    cone.rotation.z = -Math.PI / 2;
  }

  // =========================================================== labels
  const labelEls = new Map<EquipmentId, HTMLButtonElement>();
  for (const eq of EQUIPMENT) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'plant-label';
    el.style.setProperty('--sys', SYSTEMS[eq.system].color);
    el.setAttribute('aria-label', `${eq.n}. ${eq.name}`);
    const num = document.createElement('span');
    num.className = 'plant-label-num';
    num.textContent = String(eq.n);
    const name = document.createElement('span');
    name.className = 'plant-label-name';
    name.textContent = eq.short;
    el.append(num, name);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onSelect(eq.id);
    });
    const obj = new CSS2DObject(el);
    obj.position.set(...LABEL_POS[eq.id]);
    scene.add(obj);
    labelEls.set(eq.id, el);
  }

  function annotation(text: string, cls: string) {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return new CSS2DObject(el);
  }

  // =========================================================== shadows
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const noShadow = m.userData.noShadow;
    m.castShadow = !noShadow;
    m.receiveShadow = !noShadow;
  });
  topsoil.castShadow = false;

  // Equipment that should not be cut away (small drums) gets its shell restored.
  scene.traverse((o) => {
    if (!o.userData.noCut) return;
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      const idx = cutMats.findIndex((cm) => cm.mat === mat);
      if (idx >= 0) {
        cutMats.splice(idx, 1);
        mat.clippingPlanes = null;
        mat.side = THREE.FrontSide;
      }
      if (cutOnly.includes(m)) m.visible = false;
    });
  });

  // =========================================================== state
  let selected: EquipmentId | null = null;
  let animating = true;
  let streamFocus: StreamFocus = 'all';

  const selectionBox = new THREE.Box3();
  const selectionHelper = new THREE.Box3Helper(selectionBox, new THREE.Color('#38bdf8'));
  const selMat = selectionHelper.material as THREE.LineBasicMaterial;
  selMat.depthTest = false;
  selMat.transparent = true;
  selectionHelper.renderOrder = 10;
  selectionHelper.visible = false;
  scene.add(selectionHelper);

  // camera fly animation
  let fly: {
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
    dur: number;
  } | null = null;

  function flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1.1) {
    fly = {
      fromPos: camera.position.clone(),
      toPos: pos.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      t: 0,
      dur,
    };
  }

  function frameFor(id: EquipmentId): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const f = baseFrame(id);
    // The details panel covers the right side (wide screens) or the bottom (narrow
    // screens) of the viewer, so offset the view to keep the equipment visible.
    const viewDir = f.target.clone().sub(f.pos);
    const dist = viewDir.length();
    viewDir.normalize();
    const right = viewDir.clone().cross(UP).normalize();
    const camUp = right.clone().cross(viewDir).normalize();
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const shift =
      width >= 768
        ? right.multiplyScalar(halfH * camera.aspect * 0.34)
        : camUp.multiplyScalar(-halfH * 0.42);
    return { pos: f.pos.add(shift), target: f.target.add(shift) };
  }

  function baseFrame(id: EquipmentId): { pos: THREE.Vector3; target: THREE.Vector3 } {
    const custom = CUSTOM_VIEW[id];
    if (custom) return { pos: new THREE.Vector3(...custom.pos), target: new THREE.Vector3(...custom.target) };
    const g = eqGroups.get(id)!;
    const b = new THREE.Box3().setFromObject(g);
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.y * 1.2, s.z);
    const dist = THREE.MathUtils.clamp(r * 1.35 + 7, 11, 60);
    const dir = new THREE.Vector3(0.35, 0.5, 1).normalize();
    return { pos: c.clone().addScaledVector(dir, dist), target: c };
  }

  function updateLabelClasses() {
    labelEls.forEach((el, id) => {
      el.classList.toggle('is-active', id === selected);
      el.classList.toggle('is-hover', id === hovered);
    });
  }

  // =========================================================== picking
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickRoots: THREE.Object3D[] = [...eqGroups.values(), topsoil];
  let hovered: EquipmentId | null = null;

  function pick(clientX: number, clientY: number): EquipmentId | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickRoots, true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.eqId) return o.userData.eqId as EquipmentId;
        if (o.userData.ground) return null;
        o = o.parent;
      }
    }
    return null;
  }

  let downX = 0;
  let downY = 0;
  let downT = 0;
  function onPointerDown(e: PointerEvent) {
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
    fly = null; // user takes over the camera
  }
  function onPointerUp(e: PointerEvent) {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 6 || performance.now() - downT > 600) return;
    opts.onSelect(pick(e.clientX, e.clientY));
  }
  let pendingMove: { x: number; y: number } | null = null;
  function onPointerMove(e: PointerEvent) {
    if (e.buttons) return;
    pendingMove = { x: e.clientX, y: e.clientY };
  }
  function onPointerLeave() {
    pendingMove = null;
    if (hovered) {
      hovered = null;
      updateLabelClasses();
    }
    renderer.domElement.style.cursor = '';
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);

  // =========================================================== theme
  function setDark(dark: boolean) {
    const bg = new THREE.Color(dark ? '#0f1419' : '#e4ebf2');
    scene.background = bg;
    scene.fog = new THREE.Fog(bg, 140, 320);
    hemi.intensity = dark ? 0.65 : 0.9;
    sun.intensity = dark ? 2.0 : 2.4;
  }
  setDark(opts.dark);

  // =========================================================== resize
  const ro = new ResizeObserver(() => {
    const w = Math.max(host.clientWidth, 10);
    const h = Math.max(host.clientHeight, 10);
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(host);

  // =========================================================== loop
  const clock = new THREE.Clock();
  let elapsed = 0;
  let raf = 0;
  const flowSpeed = { well: 1, oil: 1, gas: 1, water: 1 } as Record<keyof FlowRates, number>;

  function tick() {
    raf = requestAnimationFrame(tick);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (animating) {
      elapsed += dt;
      (Object.keys(streamMats) as StreamKey[]).forEach((k) => {
        const sm = streamMats[k];
        const mult = k in flowSpeed ? flowSpeed[k as keyof FlowRates] : 1;
        const d = (BASE_FLOW_SPEED * sm.rate * mult * dt) / PITCH;
        sm.map.offset.y -= d;
        sm.glow.offset.y -= d;
      });
      fans.forEach((f) => (f.rotation.y += dt * 9));
      rotors.forEach((r) => (r.rotation.y += dt * 6));
      const flick = 0.85 + 0.15 * Math.sin(elapsed * 23) + 0.1 * (Math.random() - 0.5);
      flame.scale.set(1 + 0.06 * Math.sin(elapsed * 17), flick, 1 + 0.06 * Math.cos(elapsed * 13));
      flameLight.intensity = 50 + 18 * flick;
      sock.rotation.y = 0.25 * Math.sin(elapsed * 0.7);
      sock.rotation.z = -0.15 + 0.05 * Math.sin(elapsed * 3.1);
      if (cutaway) updateParticles(dt);
      animators.forEach((a) => a(elapsed, dt));
    }

    if (fly) {
      fly.t += rawDt; // wall-clock, so camera moves finish on time even at low frame rates
      const k = Math.min(fly.t / fly.dur, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
      controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e);
      if (k >= 1) fly = null;
    }
    controls.update();

    if (selectionHelper.visible) selMat.opacity = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 450));

    if (pendingMove) {
      const id = pick(pendingMove.x, pendingMove.y);
      pendingMove = null;
      if (id !== hovered) {
        hovered = id;
        updateLabelClasses();
        renderer.domElement.style.cursor = id ? 'pointer' : '';
      }
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  tick();

  // =========================================================== API
  function applyCutaway() {
    for (const { mat, plane } of cutMats) {
      mat.clippingPlanes = cutaway ? [plane] : null;
      mat.needsUpdate = true;
    }
    cutOnly.forEach((o) => {
      if (!hasNoCutAncestor(o)) o.visible = cutaway;
    });
    solidOnly.forEach((o) => (o.visible = !cutaway));
    particleRoot.visible = cutaway;
  }
  function hasNoCutAncestor(o: THREE.Object3D) {
    let p: THREE.Object3D | null = o;
    while (p) {
      if (p.userData.noCut) return true;
      p = p.parent;
    }
    return false;
  }
  applyCutaway();

  return {
    select(id, doFly = true) {
      selected = id;
      updateLabelClasses();
      if (!id) {
        selectionHelper.visible = false;
        return;
      }
      const g = eqGroups.get(id);
      if (!g) return;
      selectionBox.setFromObject(g);
      selectionBox.expandByScalar(0.3);
      selectionHelper.visible = true;
      if (doFly) {
        const f = frameFor(id);
        flyTo(f.pos, f.target);
      }
    },
    setStreamFocus(focus) {
      streamFocus = focus;
      (Object.keys(streamMats) as StreamKey[]).forEach((k) => {
        const on = streamFocus === 'all' || streamFocus === k;
        const sm = streamMats[k];
        for (const m of [sm.pipe, sm.joint]) {
          m.transparent = !on;
          m.opacity = on ? 1 : 0.1;
          m.depthWrite = on;
          m.needsUpdate = true;
        }
        sm.pipe.emissiveIntensity = streamFocus === k ? 0.9 : 0.55;
      });
    },
    setCutaway(on) {
      cutaway = on;
      applyCutaway();
    },
    setUnderground(on) {
      strataMats.forEach(({ mat, opacity }) => {
        mat.transparent = on;
        mat.opacity = on ? opacity : 1;
        mat.depthWrite = !on;
        mat.needsUpdate = true;
      });
      undergroundAnnotations.forEach((a) => (a.visible = on));
    },
    setLabels(mode) {
      labelRoot.classList.remove('labels-off', 'labels-numbers', 'labels-names');
      labelRoot.classList.add(`labels-${mode}`);
      annotations.forEach((a) => (a.visible = mode !== 'off'));
    },
    setAnimate(on) {
      animating = on;
    },
    setFlowRates(r) {
      flowSpeed.well = r.well;
      flowSpeed.oil = r.oil;
      flowSpeed.gas = r.gas;
      flowSpeed.water = r.water;
    },
    setDark,
    resetView() {
      flyTo(homePos(), HOME_TARGET);
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
      const mats = new Set<THREE.Material>();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
      });
      mats.forEach((m) => m.dispose());
      Object.values(MAT).forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      envTarget.dispose();
      particleGeo.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelRoot.remove();
    },
  };
}
