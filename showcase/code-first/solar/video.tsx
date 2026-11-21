// "Solar got cheap" (9:16): the curve IS the layout. One headline, then a falling line that fills the frame, pinned at the three moments of the story, ending in the number.
// Laid out from the content (a story about a falling curve is a chart, not a stack of cards). Figures are illustrative and the film says so.
import { AbsoluteFill, Audio, NumberTicker, Sequence, springValue, useCurrentFrame } from 'motionrender/react';

export const config = { id: 'solar', name: 'Solar got cheap', width: 1080, height: 1920, fps: 30, durationInFrames: 390, background: '#f3ede1', grain: 0.04, export: { loudness: -14 } };

const ink = '#1c1a17', muted = '#6f685c', accent = '#e0541b', rule = '#d9d0bd';
const serif = 'Fraunces, serif', sans = 'Inter, sans-serif';
const costs = [100, 62, 40, 25, 16, 10];
const W = 840, H = 620, X0 = 120, Y0 = 590;                       // the chart: left edge, top, width, height (all inside the safe zones)
const px = (i: number) => (i / (costs.length - 1)) * W, py = (v: number) => (1 - v / 100) * H * 0.92;
const path = costs.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
const pins = [
  { i: 0, at: 40, text: 'Hand-built', dx: 6, dy: -30, anchor: 'start' as const },
  { i: 2, at: 108, text: 'Factories scale', dx: 30, dy: -34, anchor: 'start' as const },
  { i: 5, at: 176, text: 'Mass production', dx: 0, dy: -110, anchor: 'end' as const },
];

export default function Video() {
  const frame = useCurrentFrame();
  const head = springValue({ frame, delay: 2, preset: 'smooth' }), draw = springValue({ frame, delay: 24, preset: 'gentle' });
  const num = springValue({ frame, delay: 196, preset: 'bouncy' }), note = springValue({ frame, delay: 232, preset: 'smooth' });
  return (
    <AbsoluteFill style={{ fontFamily: sans, color: ink }}>
      <Audio src="sfx:bed-calm" volume={0.8} />
      <Sequence from={4} durationInFrames={30}><Audio src="sfx:whoosh" volume={0.35} /></Sequence>
      {pins.map(pin => <Sequence key={pin.i} from={pin.at} durationInFrames={20}><Audio src="sfx:pop" volume={0.35} /></Sequence>)}
      <Sequence from={196} durationInFrames={40}><Audio src="sfx:thump" volume={0.45} /></Sequence>

      <div style={{ position: 'absolute', left: 80, top: 200, width: 840, fontFamily: serif, fontSize: 112, fontWeight: 600, lineHeight: 1.2, letterSpacing: -3, opacity: head, transform: `translateY(${(1 - head) * 30}px)` }}>
        <div>Solar got cheap</div>
        <div style={{ color: accent }}>by building more.</div>
      </div>

      <svg width={W + 240} height={H + 120} viewBox={`-120 -40 ${W + 240} ${H + 120}`} style={{ position: 'absolute', left: X0 - 120, top: Y0 - 40, overflow: 'visible' }}>
        <line x1={0} x2={W} y1={H * 0.92 + 14} y2={H * 0.92 + 14} stroke={rule} strokeWidth={3} />
        <text x={0} y={H * 0.92 + 56} fontSize={26} fill={muted} fontFamily={sans}>Year 1</text>
        <text x={W} y={H * 0.92 + 56} fontSize={26} fill={muted} fontFamily={sans} textAnchor="end">Year 11</text>
        <path d={`${path} L${W},${H * 0.92 + 14} L0,${H * 0.92 + 14} Z`} fill={accent} opacity={0.1 * draw} />
        <path d={path} fill="none" stroke={ink} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        {pins.map(pin => {
          const p = springValue({ frame, delay: pin.at, preset: 'bouncy' });
          return (
            <g key={pin.i} opacity={Math.min(1, p * 2)}>
              <circle cx={px(pin.i)} cy={py(costs[pin.i]!)} r={16 * p} fill={accent} />
              <text x={px(pin.i) + pin.dx} y={py(costs[pin.i]!) + pin.dy} fontSize={34} fontWeight={600} fill={ink} fontFamily={sans} textAnchor={pin.anchor}>{pin.text}</text>
            </g>
          );
        })}
      </svg>

      <div style={{ position: 'absolute', left: 80, top: 1282, display: 'flex', alignItems: 'baseline', gap: 28, opacity: Math.min(1, num * 2), transform: `translateY(${(1 - num) * 30}px)` }}>
        <div style={{ fontFamily: serif, fontSize: 180, fontWeight: 600, lineHeight: 1.2, letterSpacing: -6, color: accent }}><NumberTicker value={10} suffix="×" delay={196} /></div>
        <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.3, width: 340, opacity: note }}>cheaper per unit</div>
      </div>
      <div style={{ position: 'absolute', left: 80, top: 1516, fontSize: 26, color: muted, opacity: note }}>Illustrative figures, not a measurement.</div>
    </AbsoluteFill>
  );
}
