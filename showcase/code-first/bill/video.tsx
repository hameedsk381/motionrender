// "A bill's long walk" (9:16): the bill walks down the page through four stops, each drawn as the thing it is (a member, a committee building, a ballot box, a signed document).
// Layout from the content (a process is a path with stops); pictures from the illustration kit, so no image model or key is needed. Colours: newsprint cream, ink, one red.
import { AbsoluteFill, Audio, Illustration, Sequence, springValue, useCurrentFrame } from 'motionrender/react';

export const config = { id: 'bill', name: "A bill's long walk", width: 1080, height: 1920, fps: 30, durationInFrames: 540, background: '#f2ede2', grain: 0.04, export: { loudness: -14 } };

const ink = '#161513', muted = '#5f5b52', red = '#b3121f', cream = '#f2ede2', rule = '#d6cdb9';
const serif = '"Playfair Display", serif', sans = 'Source Sans 3, sans-serif';

const stops = [
  { art: 'person', title: 'A member introduces it' },
  { art: 'building', title: 'A committee reviews it' },
  { art: 'ballot', title: 'The chamber votes' },
  { art: 'document', title: 'The president signs' },
];
const SIZE = 290, TOP = 600, GAP = 285, LEFT_X = 195, RIGHT_X = 815, IN = 60;   // pictures are large; the path starts and ends IN pixels inside them (they are drawn over it)
const cx = (k: number) => (k % 2 === 0 ? LEFT_X : RIGHT_X), cy = (k: number) => TOP + k * GAP;
// The voice: five lines recorded with `mr voice` (their lengths in frames), each starting a beat after the one before; a stop appears as its own line begins.
const voice = [{ src: 'assets/line1.wav', frames: 66 }, { src: 'assets/line2.wav', frames: 75 }, { src: 'assets/line3.wav', frames: 116 }, { src: 'assets/line4.wav', frames: 69 }, { src: 'assets/line5.wav', frames: 129 }];
const starts = voice.reduce<number[]>((list, line, i) => [...list, i === 0 ? 6 : list[i - 1]! + voice[i - 1]!.frames + 10], []);
const at = (k: number) => starts[k + 1]!;

/** A point on the S-curve between stop k and k+1, t from 0 to 1 (the cubic the path is drawn with). */
function onPath(k: number, t: number): [number, number] {
  const [x0, y0, x1, y1] = [cx(k), cy(k) + IN, cx(k + 1), cy(k + 1) - IN], c = (y1 - y0) / 2 + 40, u = 1 - t;
  const p = (a: number, b: number, c1: number, d: number) => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c1 + t * t * t * d;
  return [p(x0, x0, x1, x1), p(y0, y0 + c, y1 - c, y1)];
}
const segments = stops.slice(0, -1).map((_, k) => {
  const [x0, y0, x1, y1] = [cx(k), cy(k) + IN, cx(k + 1), cy(k + 1) - IN], c = (y1 - y0) / 2 + 40;
  return `M${x0},${y0} C${x0},${y0 + c} ${x1},${y1 - c} ${x1},${y1}`;
});

export default function Video() {
  const frame = useCurrentFrame();
  const head = springValue({ frame, delay: 2, preset: 'smooth' });
  // The bill (a small document) walks the path: one segment between each pair of stops, starting as the stop above it appears.
  const walk = stops.slice(0, -1).reduce((sum, _, k) => sum + Math.min(1, Math.max(0, (frame - (at(k) + 30)) / (at(k + 1) - at(k) - 38))), 0), seg = Math.min(stops.length - 2, Math.floor(walk)), [mx, my] = onPath(seg, walk - seg);
  return (
    <AbsoluteFill style={{ fontFamily: sans, color: ink }}>
      <Audio src="sfx:bed-calm" volume={0.25} />
      {voice.map((line, i) => <Sequence key={line.src} from={starts[i]!} durationInFrames={line.frames + 4}><Audio src={line.src} /></Sequence>)}
      <Sequence from={2} durationInFrames={30}><Audio src="sfx:whoosh" volume={0.25} /></Sequence>
      {stops.map((_, k) => <Sequence key={k} from={at(k)} durationInFrames={20}><Audio src="sfx:pop" volume={0.35} /></Sequence>)}
      <Sequence from={at(3) + 120} durationInFrames={40}><Audio src="sfx:thump" volume={0.3} /></Sequence>

      <div style={{ position: 'absolute', left: 80, top: 186, width: 840, fontFamily: serif, fontSize: 112, fontWeight: 800, lineHeight: 1.2, letterSpacing: -2, opacity: head, transform: `translateY(${(1 - head) * 30}px)` }}>
        <div>A bill&apos;s</div>
        <div style={{ color: red }}>long walk.</div>
      </div>

      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', left: 0, top: 0 }}>
        {segments.map((d, k) => {
          const draw = springValue({ frame, delay: at(k) + 24, preset: 'gentle' });
          return <path key={k} d={d} fill="none" stroke={rule} strokeWidth={8} strokeLinecap="round" strokeDasharray="2 18" pathLength={undefined} opacity={Math.min(1, draw * 2)} />;
        })}
        <g opacity={Math.min(1, Math.max(0, (frame - 56) / 12))} transform={`translate(${mx - 22},${my - 28})`}>
          <rect width={44} height={56} rx={6} fill={cream} stroke={ink} strokeWidth={5} />
          <line x1={11} y1={18} x2={33} y2={18} stroke={ink} strokeWidth={4} strokeLinecap="round" />
          <line x1={11} y1={30} x2={33} y2={30} stroke={ink} strokeWidth={4} strokeLinecap="round" />
          <rect x={11} y={40} width={14} height={8} rx={2} fill={red} />
        </g>
      </svg>

      {stops.map((stop, k) => {
        const p = springValue({ frame, delay: at(k), preset: 'smooth' }), left = k % 2 === 0;
        return (
          <div key={k}>
            <div style={{ position: 'absolute', left: cx(k) - SIZE / 2, top: cy(k) - SIZE / 2, opacity: Math.min(1, p * 2) }}>
              <Illustration name={stop.art} size={SIZE} color={red} ink={ink} paper={cream} delay={at(k)} />
            </div>
            <div style={{ position: 'absolute', top: cy(k) - 60, ...(left ? { left: 360 } : { left: 70 }), width: 570, textAlign: left ? 'left' : 'right', opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, color: red, lineHeight: 1.4 }}>STEP {k + 1}</div>
              <div style={{ fontFamily: serif, fontSize: 46, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{stop.title}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
