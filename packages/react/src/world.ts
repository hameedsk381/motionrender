// Cinematic 3D worlds for explainer videos, drawn with three.js: a camera moves through a procedural city, a stretch of terrain or a data-centre aisle,
// lit for a mood (night, dusk, dawn, noon). Nothing is a downloaded asset and nothing is random: the same seed builds the same world, and every
// value that moves (the camera, the cars, the blinking lights) is a pure function of the frame, so a frame renders the same picture every time.
// This file is its own entry (`motionrender/world`) because it brings three.js with it: a video that has no world scene never loads it.
import { createElement as h, useLayoutEffect, useRef, type ReactElement } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// '@ove/react' is the same module the rest of the video uses (the build aliases it), so the frame context is shared, not duplicated in this bundle.
import { useCurrentFrame, KineticText } from '@ove/react';

export type WorldKind = 'city' | 'terrain' | 'racks';
export type WorldMove = 'auto' | 'flyover' | 'orbit' | 'dolly' | 'crane';
export type WorldMood = 'night' | 'dusk' | 'dawn' | 'noon';
export type WorldProps = {
  world: WorldKind; move: WorldMove; mood: WorldMood; seed: number;
  /** How many frames the scene lasts: the camera's path is spread over them. */ frames: number;
  width: number; height: number;
  accent: string; accent2: string; text: string; fontDisplay: string;
  title?: string; caption?: string;
};

type Scene3 = { scene: any; camera: any; renderer: any; update: (frame: number) => void; ground: (x: number, z: number) => number };

const mulberry = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const MOODS: Record<WorldMood, { sky: string; fog: string; density: number; ambient: number; sun: string; sunPower: number; windows: number; ground: string; hill: [string, string, string, string, string] }> = {
  night: { sky: '#050914', fog: '#0a1226', density: 0.0105, ambient: 0.55, sun: '#7e92e0', sunPower: 0.9, windows: 1.25, ground: '#0b1020', hill: ['#0e2c4d', '#243a2c', '#2f4a35', '#4b4f57', '#aab4c8'] },
  dusk: { sky: '#2b1b3d', fog: '#4a2a4d', density: 0.0095, ambient: 0.75, sun: '#ff9a62', sunPower: 1.8, windows: 0.9, ground: '#1a1426', hill: ['#274a73', '#8a7a4d', '#4f6b3a', '#6b5a5a', '#f3e6e6'] },
  dawn: { sky: '#f0b9a0', fog: '#efc6b5', density: 0.008, ambient: 0.9, sun: '#ffd2a0', sunPower: 2.0, windows: 0.3, ground: '#3a3340', hill: ['#4f86b5', '#cdb98a', '#7ea35c', '#8b7f7f', '#fff4ee'] },
  noon: { sky: '#8ec5ff', fog: '#bfe0ff', density: 0.0055, ambient: 1.1, sun: '#ffffff', sunPower: 2.6, windows: 0, ground: '#6b7280', hill: ['#2f7fc1', '#d9c78e', '#5e9a3e', '#7d7468', '#ffffff'] },
};

const hex = (value: string, fallback = '#38bdf8') => (/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);

/** Window lights painted on a small canvas: a 64 x 128 tile of 8 x 16 windows, some lit, in the given colours. */
function windowTexture(rnd: () => number, colours: string[], density: number) {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 128;
  const g = canvas.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 8) for (let x = 4; x < 60; x += 8) if (rnd() < density) { g.fillStyle = colours[Math.floor(rnd() * colours.length)]!; g.fillRect(x, y, 4, 5); }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.magFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** LED rows on a rack's front: a 64 x 128 tile with rows of small lights in green, the accent, amber and red. */
function ledTexture(rnd: () => number, accent: string) {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 128;
  const g = canvas.getContext('2d')!; g.fillStyle = '#05070c'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 124; y += 10) { g.fillStyle = '#10151f'; g.fillRect(4, y - 2, 56, 8); for (let x = 8; x < 58; x += 6) if (rnd() < 0.55) { g.fillStyle = [accent, '#3dd68c', '#3dd68c', '#f5a524', '#ff5d6c'][Math.floor(rnd() * 5)]!; g.fillRect(x, y, 3, 3); } }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter;
  return texture;
}

/** Stretches a box's side faces so a window tile repeats at a constant size whatever the building's size. */
function tileBox(width: number, height: number, depth: number) {
  const geometry = new THREE.BoxGeometry(width, height, depth), uv = geometry.attributes.uv;
  // Faces in order: +x, -x, +y, -y, +z, -z, four vertices each. Sides span the depth (x faces) or the width (z faces); top and bottom sample the dark edge.
  for (let face = 0; face < 6; face++) for (let k = 0; k < 4; k++) {
    const i = face * 4 + k, u = uv.getX(i), v = uv.getY(i);
    if (face === 2 || face === 3) uv.setXY(i, 0.01, 0.01);
    else uv.setXY(i, u * ((face < 2 ? depth : width) / 7), v * (height / 13));
  }
  return geometry;
}

/* ---- the city: blocks of buildings with lit windows, streets with moving car lights ---- */
function city(rnd: () => number, mood: typeof MOODS[WorldMood], accent: string, accent2: string): { group: any; update: (frame: number) => void; ground: () => number } {
  const group = new THREE.Group();
  const lights = [accent, accent2, '#ffd9a0', '#fff1c9', '#ffd9a0'];
  const materials = [0, 1, 2].map(k => new THREE.MeshStandardMaterial({ color: ['#161d30', '#1b2338', '#12182a'][k]!, roughness: 0.85, metalness: 0.1, emissive: new THREE.Color('#ffffff'), emissiveMap: windowTexture(rnd, lights, 0.32 + k * 0.1), emissiveIntensity: mood.windows }));
  const pitch = 14, half = 9, parts: any[][] = [[], [], []];
  for (let gx = -half; gx <= half; gx++) for (let gz = -half; gz <= half; gz++) {
    if (rnd() < 0.06) continue;   // a park or an empty lot
    const w = 6 + rnd() * 3, d = 6 + rnd() * 3, centre = Math.min(1, Math.hypot(gx, gz) / 11), height = 4 + Math.pow(rnd(), 2.3) * 40 * (1.2 - centre * 0.85);
    const box = tileBox(w, height, d); box.translate(gx * pitch + (rnd() - 0.5) * 1.2, height / 2, gz * pitch + (rnd() - 0.5) * 1.2);
    parts[Math.floor(rnd() * 3)]!.push(box);
  }
  // One mesh per window material (3 draw calls), not one per building (about 360): software WebGL pays for every draw call.
  parts.forEach((list, k) => { if (list.length) group.add(new THREE.Mesh(mergeGeometries(list), materials[k])); });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: mood.ground, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; group.add(ground);
  // Car lights: small bright boxes on the streets between the blocks, moving at their own speeds.
  const cars = 160, carMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.5, 1.8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), cars);
  const lanes = Array.from({ length: cars }, (_, i) => ({ x: ((i * 7) % 18 - 9 + 0.5) * pitch, along: i % 2 === 0, speed: 6 + rnd() * 14, offset: rnd() * 260, dir: rnd() < 0.5 ? -1 : 1, lane: ((i * 7) % 18 - 9 + 0.5) * pitch }));
  lanes.forEach((_, i) => carMesh.setColorAt(i, new THREE.Color(rnd() < 0.5 ? '#ffe9b0' : (rnd() < 0.5 ? '#ff4d5a' : accent))));
  group.add(carMesh);
  const dummy = new THREE.Object3D();
  const update = (frame: number) => {
    const time = frame / 30;
    lanes.forEach((car, i) => {
      const along = (((car.offset + car.dir * car.speed * time) % 260) + 260) % 260 - 130, side = car.dir * 1.2;
      if (car.along) dummy.position.set(car.x + side, 0.4, along); else dummy.position.set(along, 0.4, car.x + side);
      dummy.rotation.y = car.along ? 0 : Math.PI / 2; dummy.updateMatrix(); carMesh.setMatrixAt(i, dummy.matrix);
    });
    carMesh.instanceMatrix.needsUpdate = true;
  };
  return { group, update, ground: () => 0 };
}

/* ---- terrain: hills with a shoreline, trees and a low sun, in flat-shaded facets ---- */
function terrain(rnd: () => number, mood: typeof MOODS[WorldMood], seed: number) {
  const grid = new Float32Array(256 * 256); const gr = mulberry(seed * 7919 + 13); for (let i = 0; i < grid.length; i++) grid[i] = gr();
  const value = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi), at = (a: number, b: number) => grid[((b & 255) * 256) + (a & 255)]!;
    return mix(mix(at(xi, yi), at(xi + 1, yi), xf), mix(at(xi, yi + 1), at(xi + 1, yi + 1), xf), yf); };
  const fbm = (x: number, y: number) => { let sum = 0, amp = 0.55, f = 1; for (let o = 0; o < 5; o++) { sum += value(x * f, y * f) * amp; amp *= 0.5; f *= 2; } return sum; };
  const height = (x: number, z: number) => Math.max(-1.2, (fbm(x * 0.018 + 7, z * 0.018 + 3) - 0.38) * 62);
  const group = new THREE.Group(), size = 360, segments = 120;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments); geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position, colours = new Float32Array(position.count * 3), c = new THREE.Color(), [water, sand, grass, rock, snow] = mood.hill;
  for (let i = 0; i < position.count; i++) {
    const y = height(position.getX(i), position.getZ(i)); position.setY(i, y);
    c.set(y < 0.4 ? water : y < 1.6 ? sand : y < 9 ? grass : y < 17 ? rock : snow); const shade = 0.9 + ((i * 2654435761) % 1000) / 10000; c.multiplyScalar(shade);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3)); geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })));
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: mood.hill[0], roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.86 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = 0.35; group.add(sea);
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(0.9, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#2e6b3f', flatShading: true, roughness: 0.9 }), 520), dummy = new THREE.Object3D();
  let placed = 0; for (let tries = 0; tries < 4000 && placed < 520; tries++) { const x = (rnd() - 0.5) * size * 0.9, z = (rnd() - 0.5) * size * 0.9, y = height(x, z); if (y > 1.8 && y < 8) { dummy.position.set(x, y + 1.5, z); dummy.scale.setScalar(0.8 + rnd() * 0.9); dummy.updateMatrix(); trees.setMatrixAt(placed++, dummy.matrix); } }
  trees.count = placed; group.add(trees);
  return { group, update: (frame: number) => { sea.position.y = 0.35 + Math.sin(frame / 40) * 0.05; }, ground: height };
}

/* ---- a data-centre aisle: two rows of racks with blinking lights, strip lights overhead, a glow at the far end ---- */
function racks(rnd: () => number, mood: typeof MOODS[WorldMood], accent: string) {
  const group = new THREE.Group(), leds = [0, 1, 2, 3].map(() => ledTexture(rnd, accent));
  const ledMaterials = leds.map(map => new THREE.MeshStandardMaterial({ color: '#10151f', roughness: 0.5, metalness: 0.6, emissive: new THREE.Color('#ffffff'), emissiveMap: map, emissiveIntensity: 1 }));
  const metal = new THREE.MeshStandardMaterial({ color: '#141a26', roughness: 0.55, metalness: 0.7 });
  const length = 96, depth = 0.95, count = Math.floor(length / depth), bodies: any[] = [], fronts: any[][] = ledMaterials.map(() => []);
  // The racks are a few merged meshes (all the dark bodies, and the LED fronts grouped by which blinking material they use) instead of two hundred
  // multi-material boxes: software WebGL pays for every draw call.
  for (let side = -1; side <= 1; side += 2) for (let k = 0; k < count; k++) {
    const z = 44 - k * depth, body = new THREE.BoxGeometry(1.1, 2.5, depth - 0.04); body.translate(side * 1.85, 1.25, z); bodies.push(body);
    const front = new THREE.PlaneGeometry(depth - 0.06, 2.4); front.rotateY(side < 0 ? Math.PI / 2 : -Math.PI / 2); front.translate(side * 1.85 - side * 0.552, 1.25, z);
    fronts[Math.floor(rnd() * ledMaterials.length)]!.push(front);
  }
  group.add(new THREE.Mesh(mergeGeometries(bodies), metal));
  fronts.forEach((list, k) => { if (list.length) group.add(new THREE.Mesh(mergeGeometries(list), ledMaterials[k])); });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, length + 8), new THREE.MeshStandardMaterial({ color: '#0b0f18', roughness: 0.35, metalness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.position.z = 0; group.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8, length + 8), new THREE.MeshStandardMaterial({ color: '#0a0d14', roughness: 0.9 })); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 3.4; group.add(ceiling);
  const strip = new THREE.MeshBasicMaterial({ color: '#56668a' });
  const lamps: any[] = []; for (let z = 46; z > -50; z -= 4.5) { const lamp = new THREE.BoxGeometry(0.09, 0.04, 2.0); lamp.translate(0, 3.38, z); lamps.push(lamp); }
  group.add(new THREE.Mesh(mergeGeometries(lamps), strip));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(0.32) })); glow.position.set(0, 1.6, -50); group.add(glow);
  return { group, update: (frame: number) => ledMaterials.forEach((m, i) => { const on = Math.sin(frame * (0.09 + i * 0.03) + i * 2.1) > -0.25; m.emissiveIntensity = on ? 1.15 : 0.35; }), ground: () => 0 };
}

/** Where the camera is, and what it looks at, `t` of the way through the scene (0 to 1). */
function camera(kind: WorldKind, move: Exclude<WorldMove, 'auto'>, t: number, ground: (x: number, z: number) => number) {
  const e = mix(t, smooth(t), 0.45);
  let pos: [number, number, number], look: [number, number, number];
  if (kind === 'racks') {
    if (move === 'orbit' || move === 'crane') {
      const a = e * Math.PI * 0.9 - 0.45; pos = [Math.sin(a) * 4.5, move === 'crane' ? mix(0.9, 3, e) : 1.7, 6 - e * 8 + Math.cos(a) * 1.5]; look = [0, 1.5, pos[2] - 10];
    } else { const z = 38 - e * 76; pos = [Math.sin(e * 5) * 0.12, 1.65 + Math.sin(e * 23) * 0.015, z]; look = [Math.sin(e * 3) * 0.3, 1.6, z - 14]; }
  } else if (move === 'orbit') {
    const r = kind === 'city' ? 115 : 105, a = -0.6 + e * Math.PI * 1.35, base = kind === 'city' ? 58 : 30;
    pos = [Math.sin(a) * r, Math.max(base, ground(Math.sin(a) * r, Math.cos(a) * r) + 10), Math.cos(a) * r]; look = [0, kind === 'city' ? 12 : 4, 0];
  } else if (move === 'crane') {
    const a = 0.7 + e * 0.9, r = kind === 'city' ? 105 : 100; const x = Math.sin(a) * r, z = Math.cos(a) * r;
    pos = [x, Math.max(mix(kind === 'city' ? 46 : 4, kind === 'city' ? 95 : 60, e), ground(x, z) + 6), z]; look = [0, kind === 'city' ? 8 : 2, 0];
  } else {
    const z = kind === 'city' ? 165 - e * 250 : 120 - e * 190, x = Math.sin(e * 2.4) * (kind === 'city' ? 7 : 26), floor = ground(x, z);
    const ahead = kind === 'city' ? 0 : Math.max(ground(x, z - 14), ground(x, z - 30), ground(x, z - 50));
    pos = [x, Math.max(kind === 'city' ? mix(80, 56, e) + Math.sin(e * 9) * 0.8 : mix(26, 18, e), floor + 9, ahead + 8), z]; look = [x * 0.5, kind === 'city' ? 0 : Math.max(4, ground(x * 0.5, z - 40) + 4), z - (kind === 'city' ? 62 : 36)];
  }
  return { pos, look };
}

function build(props: WorldProps, canvas: HTMLCanvasElement): Scene3 {
  const mood = MOODS[props.mood], accent = hex(props.accent), accent2 = hex(props.accent2, '#a78bfa'), rnd = mulberry(props.seed * 104729 + 17);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  // The canvas is drawn at the size the video is being rendered at (a draft is half size): software WebGL costs time by the pixel, and a draft does not need pixels it will throw away.
  const detail = clamp(Number((globalThis as any).__oveRenderScale) || 1, 0.25, 1);
  renderer.setSize(Math.round(props.width * detail), Math.round(props.height * detail), false); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = props.mood === 'noon' ? 0.95 : 1.15;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(props.world === 'racks' ? 56 : 50, props.width / props.height, 0.1, 600);
  const inDoors = props.world === 'racks';
  scene.background = new THREE.Color(inDoors ? '#04060b' : mood.sky); scene.fog = new THREE.FogExp2(inDoors ? '#05080f' : mood.fog, inDoors ? 0.028 : mood.density);
  scene.add(new THREE.HemisphereLight(inDoors ? '#6f86c8' : mood.sky, inDoors ? '#0a0e16' : mood.ground, inDoors ? 0.5 : mood.ambient));
  const sun = new THREE.DirectionalLight(inDoors ? '#9fb4ff' : mood.sun, inDoors ? 0.5 : mood.sunPower); sun.position.set(-60, 90, 40); scene.add(sun);
  const built = props.world === 'terrain' ? terrain(rnd, mood, props.seed) : props.world === 'racks' ? racks(rnd, mood, accent) : city(rnd, mood, accent, accent2);
  scene.add(built.group);
  const move: Exclude<WorldMove, 'auto'> = props.move === 'auto' ? (props.world === 'racks' ? 'dolly' : 'flyover') : props.move;
  return { scene, camera: cam, renderer, ground: built.ground as any, update: frame => {
    const t = clamp(frame / Math.max(1, props.frames - 1)), { pos, look } = camera(props.world, move, t, built.ground as any);
    cam.position.set(pos[0], pos[1], pos[2]); cam.lookAt(look[0], look[1], look[2]); built.update(frame); renderer.render(scene, cam);
  } };
}

/** A cinematic 3D scene filling its box: the canvas, a vignette and the title, one frame at a time. */
export function World(props: WorldProps): ReactElement {
  const frame = useCurrentFrame(), canvas = useRef<HTMLCanvasElement>(null), state = useRef<Scene3 | null>(null);
  useLayoutEffect(() => {
    if (!canvas.current) return;
    if (!state.current) state.current = build(props, canvas.current);
    state.current.update(frame);
  }, [frame, props]);   // every render draws: the picture is a function of the frame and the props
  const tall = props.height > props.width, rise = clamp((frame - 14) / 26);
  return h('div', { style: { position: 'absolute', left: 0, top: 0, width: props.width, height: props.height, overflow: 'hidden' } },
    h('canvas', { ref: canvas, width: props.width, height: props.height, style: { position: 'absolute', left: 0, top: 0, width: props.width, height: props.height } }),
    h('div', { key: 'vignette', style: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.62) 100%)' } }),
    h('div', { key: 'shade', style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.6))' } }),
    props.title ? h('div', { key: 'title', style: { position: 'absolute', left: '7%', right: '7%', bottom: tall ? '27%' : '17%', fontFamily: `"${props.fontDisplay}", sans-serif`, fontWeight: 800, fontSize: Math.round(props.width * (tall ? 0.092 : 0.052)), lineHeight: 1.02, color: '#ffffff', textShadow: '0 4px 28px rgba(0,0,0,0.55)', opacity: clamp(rise * 2) } },
      h(KineticText, { text: props.title, delay: 14, staggerDelay: 3, preset: 'snappy' })) : null,
    props.caption ? h('div', { key: 'caption', style: { position: 'absolute', left: '7%', right: '7%', bottom: tall ? '21.5%' : '10%', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: Math.round(props.width * (tall ? 0.036 : 0.021)), lineHeight: 1.3, color: 'rgba(255,255,255,0.88)', opacity: clamp((frame - 40) / 20) } }, props.caption) : null);
}
