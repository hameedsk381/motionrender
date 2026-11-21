// A data story, wide (16:9): bars grow, numbers count up, one bar is picked out. The numbers are illustrative sample data and the video says so.
import { AbsoluteFill, NumberTicker, Sequence, springValue, useCurrentFrame } from 'motionrender/react';

export const config = { id: 'data', name: 'Data story', width: 1920, height: 1080, fps: 30, durationInFrames: 300, background: '#0b1224' };

const rows = [
  { label: 'One laptop', value: 6 },
  { label: 'Four pages', value: 14 },
  { label: 'Eight cores', value: 31 },
  { label: 'A GPU', value: 58 },
];
const max = 58, accent = '#5eead4', muted = '#7b88a8';

function Bars() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: '210px 180px 120px', fontFamily: 'Space Grotesk, sans-serif', color: '#eef2ff', gap: 46, justifyContent: 'center' }}>
      {rows.map((row, i) => {
        const at = 14 + i * 16, grow = springValue({ frame, delay: at, preset: 'smooth' }), last = i === rows.length - 1;
        return (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            <div style={{ width: 300, fontSize: 40, fontWeight: 500, color: last ? '#eef2ff' : muted }}>{row.label}</div>
            <div style={{ flex: 1, height: 64, background: '#16203a', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ width: `${(row.value / max) * 100 * grow}%`, height: '100%', background: last ? accent : '#3b4f86', borderRadius: 14 }} />
            </div>
            <div style={{ width: 150, fontSize: 52, fontWeight: 700, textAlign: 'right', color: last ? accent : '#eef2ff' }}><NumberTicker value={row.value} delay={at} /></div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function Callout() {
  const frame = useCurrentFrame();
  const p = springValue({ frame, delay: 6, preset: 'bouncy' });
  return (
    <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'flex-start', padding: '80px 140px', fontFamily: 'Space Grotesk, sans-serif' }}>
      <div style={{ transform: `scale(${0.7 + 0.3 * p})`, opacity: Math.min(1, p * 2), textAlign: 'right' }}>
        <div style={{ fontSize: 150, fontWeight: 800, color: accent, lineHeight: 1 }}>9.7×</div>
        <div style={{ fontSize: 40, color: '#eef2ff', marginTop: 10 }}>faster with a GPU, in this sample</div>
      </div>
    </AbsoluteFill>
  );
}

export default function Video() {
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 180, top: 90, fontFamily: 'Space Grotesk, sans-serif', color: '#eef2ff' }}>
        <div style={{ fontSize: 70, fontWeight: 800 }}>Frames rendered per minute</div>
        <div style={{ fontSize: 30, color: muted, marginTop: 12 }}>Sample data for illustration only</div>
      </div>
      <Sequence from={0} durationInFrames={300}><Bars /></Sequence>
      <Sequence from={130} durationInFrames={170}><Callout /></Sequence>
    </AbsoluteFill>
  );
}
