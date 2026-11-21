// A small set of drawn illustrations for code-first videos: a server, a phone, a ballot box, a solar panel and so on, in one flat style that takes the
// video's own colours. Each draws itself on (its outline first, then its colour), so a scene can have a picture of its subject without an image model, a key
// or a file. Every shape is a path in a 200 x 200 box; `Illustration` scales it, colours it and animates it from the frame.
import { createElement as h, type ReactElement } from 'react';
import { useCurrentFrame } from './index';
import { springValue, type SpringPreset } from './springs';

type Role = 'accent' | 'soft' | 'paper' | 'ink' | 'none';
type Shape = { d: string; fill?: Role; stroke?: boolean; width?: number };

const rect = (x: number, y: number, w: number, k: number, r = 0) => `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + k - r} Q${x + w},${y + k} ${x + w - r},${y + k} H${x + r} Q${x},${y + k} ${x},${y + k - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
const disc = (cx: number, cy: number, r: number) => `M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
const line = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} L${x2},${y2}`;

const art: Record<string, Shape[]> = {
  server: [
    { d: rect(30, 30, 140, 40, 8), fill: 'paper' }, { d: rect(30, 80, 140, 40, 8), fill: 'paper' }, { d: rect(30, 130, 140, 40, 8), fill: 'paper' },
    { d: disc(54, 50, 6), fill: 'accent' }, { d: disc(54, 100, 6), fill: 'accent' }, { d: disc(54, 150, 6), fill: 'accent' },
    { d: line(90, 50, 150, 50), stroke: true }, { d: line(90, 100, 150, 100), stroke: true }, { d: line(90, 150, 150, 150), stroke: true },
  ],
  phone: [
    { d: rect(60, 16, 80, 168, 16), fill: 'paper' }, { d: rect(70, 40, 60, 112, 6), fill: 'soft' }, { d: disc(100, 168, 5), fill: 'accent' },
    { d: rect(76, 52, 36, 18, 6), fill: 'accent' }, { d: rect(88, 80, 36, 18, 6), fill: 'paper' }, { d: rect(76, 108, 30, 18, 6), fill: 'accent' },
  ],
  laptop: [
    { d: rect(38, 40, 124, 90, 8), fill: 'soft' }, { d: rect(50, 52, 100, 66, 4), fill: 'paper' },
    { d: 'M18,140 H182 L170,162 H30 Z', fill: 'paper' }, { d: line(76, 152, 124, 152), stroke: true },
    { d: line(62, 72, 120, 72), stroke: true }, { d: line(62, 90, 138, 90), stroke: true }, { d: line(62, 106, 100, 106), stroke: true },
  ],
  person: [
    { d: disc(100, 62, 28), fill: 'paper' }, { d: 'M48,176 C48,122 152,122 152,176 Z', fill: 'accent' },
  ],
  building: [
    { d: rect(46, 34, 108, 140, 4), fill: 'paper' }, { d: rect(86, 134, 28, 40, 2), fill: 'accent' },
    ...[0, 1, 2].flatMap(row => [0, 1, 2].map(col => ({ d: rect(60 + col * 32, 50 + row * 26, 20, 16, 2), fill: 'soft' as Role }))),
  ],
  document: [
    { d: 'M54,20 H122 L152,50 V180 H54 Z', fill: 'paper' }, { d: 'M122,20 V50 H152', fill: 'none' },
    { d: line(70, 80, 136, 80), stroke: true }, { d: line(70, 104, 136, 104), stroke: true }, { d: line(70, 128, 136, 128), stroke: true }, { d: rect(70, 144, 40, 18, 4), fill: 'accent' },
  ],
  bars: [
    { d: line(24, 170, 176, 170), stroke: true }, { d: rect(40, 120, 26, 50, 4), fill: 'soft' }, { d: rect(80, 90, 26, 80, 4), fill: 'soft' }, { d: rect(120, 40, 26, 130, 4), fill: 'accent' },
  ],
  globe: [
    { d: disc(100, 100, 74), fill: 'soft' }, { d: 'M100,26 C60,60 60,140 100,174 C140,140 140,60 100,26', fill: 'none' }, { d: line(26, 100, 174, 100), stroke: true },
    { d: 'M34,66 Q100,84 166,66', fill: 'none' }, { d: 'M34,134 Q100,116 166,134', fill: 'none' },
  ],
  ballot: [
    { d: 'M76,24 H124 V96 H76 Z', fill: 'paper' }, { d: 'M88,52 L98,62 L114,40', fill: 'none' },
    { d: rect(34, 92, 132, 84, 8), fill: 'accent' }, { d: rect(66, 86, 68, 12, 4), fill: 'ink' },
  ],
  tree: [
    { d: rect(92, 120, 16, 56, 3), fill: 'ink' }, { d: disc(100, 82, 44), fill: 'accent' }, { d: disc(66, 108, 28), fill: 'accent' }, { d: disc(134, 108, 28), fill: 'accent' },
  ],
  shield: [
    { d: 'M100,20 L162,42 V96 C162,138 134,164 100,180 C66,164 38,138 38,96 V42 Z', fill: 'soft' }, { d: 'M72,98 L92,118 L130,76', fill: 'none' },
  ],
  lock: [
    { d: 'M72,92 V68 A28,28 0 0 1 128,68 V92', fill: 'none' }, { d: rect(52, 92, 96, 80, 12), fill: 'accent' }, { d: disc(100, 128, 9), fill: 'paper' }, { d: line(100, 134, 100, 152), stroke: true },
  ],
  coin: [
    { d: disc(100, 100, 70), fill: 'accent' }, { d: disc(100, 100, 48), fill: 'none' }, { d: 'M100,70 V130 M84,84 Q100,70 116,84 Q116,100 100,100 Q84,100 84,116 Q100,130 116,116', fill: 'none' },
  ],
  bolt: [{ d: 'M116,16 L52,112 H94 L80,184 L148,78 H106 Z', fill: 'accent' }],
  sun: [
    { d: disc(100, 100, 38), fill: 'accent' },
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a); return { d: line(100 + c * 56, 100 + s * 56, 100 + c * 80, 100 + s * 80), stroke: true } as Shape; }),
  ],
  panel: [
    { d: 'M38,64 H162 L180,128 H20 Z', fill: 'soft' }, { d: line(79, 64, 70, 128), stroke: true }, { d: line(121, 64, 130, 128), stroke: true }, { d: line(29, 96, 171, 96), stroke: true },
    { d: line(100, 128, 100, 168), stroke: true }, { d: line(70, 170, 130, 170), stroke: true }, { d: disc(160, 30, 14), fill: 'accent' },
  ],
  cloud: [{ d: 'M54,148 C24,148 24,100 60,100 C62,64 114,56 126,92 C160,84 176,128 148,148 Z', fill: 'soft' }, { d: line(70, 126, 130, 126), stroke: true }],
  heart: [{ d: 'M100,170 C30,120 30,52 70,46 C88,44 98,56 100,66 C102,56 112,44 130,46 C170,52 170,120 100,170 Z', fill: 'accent' }],
  bulb: [
    { d: 'M100,26 C64,26 50,56 62,84 C70,100 78,106 78,124 H122 C122,106 130,100 138,84 C150,56 136,26 100,26 Z', fill: 'soft' },
    { d: rect(80, 132, 40, 14, 4), fill: 'paper' }, { d: rect(86, 154, 28, 12, 4), fill: 'paper' },
  ],
  truck: [
    { d: rect(16, 56, 104, 80, 6), fill: 'soft' }, { d: 'M120,76 H156 L182,104 V136 H120 Z', fill: 'paper' }, { d: disc(54, 142, 16), fill: 'accent' }, { d: disc(148, 142, 16), fill: 'accent' },
  ],
};

export const illustrationNames = Object.keys(art);
export type IllustrationName = keyof typeof art | (string & {});

const clamp = (x: number) => Math.min(1, Math.max(0, x));

export type IllustrationProps = {
  /** One of `illustrationNames`: server, phone, laptop, person, building, document, bars, globe, ballot, tree, shield, lock, coin, bolt, sun, panel, cloud, heart, bulb, truck. */
  name: IllustrationName;
  /** Width and height in pixels (default 320). */ size?: number;
  /** The accent fill (default the warm orange of the starter). */ color?: string;
  /** Outline and ink (default near-black). */ ink?: string;
  /** What "paper" parts are filled with: set it to the video's background so they read as open shapes (default white). */ paper?: string;
  /** Frames before it starts drawing. */ delay?: number;
  /** Spring for the drawing (default smooth). */ preset?: SpringPreset;
  /** Show it fully drawn, with no animation. */ drawn?: boolean;
  strokeWidth?: number;
};

/** A drawn illustration of a subject, drawing itself on from `delay`: its outline first, then its colour. Pure in the frame like every kit component. */
export function Illustration({ name, size = 320, color = '#e0541b', ink = '#1c1a17', paper = '#ffffff', delay = 0, preset = 'smooth', drawn = false, strokeWidth = 6 }: IllustrationProps): ReactElement {
  const frame = useCurrentFrame();
  const shapes = art[name];
  if (!shapes) throw new Error(`Unknown illustration "${name}": use one of ${illustrationNames.join(', ')}`);
  const p = drawn ? 1 : springValue({ frame, delay, preset }), fillIn = clamp((p - 0.45) * 2);
  const paint = (role: Role) => (role === 'accent' ? color : role === 'soft' ? color : role === 'paper' ? paper : role === 'ink' ? ink : 'none');
  return h('svg', { width: size, height: size, viewBox: '0 0 200 200', style: { overflow: 'visible' } },
    ...shapes.map((shape, i) => {
      const role = shape.fill ?? 'none';
      return h('path', {
        key: i, d: shape.d, fill: paint(role), fillOpacity: (role === 'soft' ? 0.22 : 1) * fillIn, stroke: ink, strokeWidth: shape.width ?? strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
        pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - clamp(p * 1.15),
      });
    }));
}
