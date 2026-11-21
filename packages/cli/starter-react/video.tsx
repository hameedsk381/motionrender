// A video is a React component: what is on screen is a function of the frame, so the same frame draws the same picture on every render.
// Check it:  mr make video.tsx          (builds it, runs the design review and draws one contact sheet of the whole video)
// Preview:   mr make video.tsx --draft  (a quick half-size MP4)
// Render:    mr render video.tsx --output out.mp4
// The build writes a hidden .motionrender/ folder beside this file; there is no composition.json to keep or edit.
import { AbsoluteFill, AmbientGlow, Sequence, springValue, useCurrentFrame } from 'motionrender/react';

export const config = { id: 'starter', name: 'Starter', width: 1920, height: 1080, fps: 30, durationInFrames: 300, background: '#0c0d10' };

const ink = '#f4f1ea', accent = '#7dd3fc';
const centred = { alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: ink } as const;

function Title() {
  const frame = useCurrentFrame();
  const rise = springValue({ frame, delay: 6, preset: 'smooth' });
  return (
    <AbsoluteFill style={centred}>
      <div style={{ fontSize: 112, fontWeight: 800, textAlign: 'center', opacity: Math.min(1, rise * 1.5), transform: `translateY(${(1 - rise) * 40}px)` }}>A video, written as code</div>
      <div style={{ fontSize: 40, color: accent, marginTop: 28, opacity: Math.min(1, Math.max(0, (frame - 24) / 16)) }}>Springs, text and layout, all frame-exact</div>
    </AbsoluteFill>
  );
}

function Points() {
  const frame = useCurrentFrame();
  const points = ['Write the video as a component', 'Check it with mr make video.tsx', 'Render it with mr render video.tsx'];
  return (
    <AbsoluteFill style={{ ...centred, alignItems: 'flex-start', paddingLeft: 280, gap: 36 }}>
      {points.map((point, i) => {
        const p = springValue({ frame, delay: 8 + i * 22, preset: 'snappy' });
        return <div key={point} style={{ fontSize: 64, fontWeight: 700, opacity: Math.min(1, p * 1.4), transform: `translateX(${(1 - p) * 80}px)` }}><span style={{ color: accent }}>{i + 1}</span> {point}</div>;
      })}
    </AbsoluteFill>
  );
}

function Closing() {
  const frame = useCurrentFrame();
  const p = springValue({ frame, delay: 4, preset: 'bouncy' });
  return (
    <AbsoluteFill style={centred}>
      <div style={{ fontSize: 96, fontWeight: 800, transform: `scale(${0.8 + 0.2 * p})`, opacity: Math.min(1, p * 2) }}>Now make yours</div>
    </AbsoluteFill>
  );
}

export default function Video() {
  return (
    <AbsoluteFill>
      <AmbientGlow />
      <Sequence from={0} durationInFrames={120}><Title /></Sequence>
      <Sequence from={120} durationInFrames={120}><Points /></Sequence>
      <Sequence from={240} durationInFrames={60}><Closing /></Sequence>
    </AbsoluteFill>
  );
}
