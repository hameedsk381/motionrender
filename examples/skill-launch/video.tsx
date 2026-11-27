import { AbsoluteFill, Audio, Sequence, springValue, useCurrentFrame } from 'motionrender/react';

export const config = { id: 'skill-launch', name: 'MotionRender Skill Suite', width: 1080, height: 1920, fps: 30, durationInFrames: 450, background: '#efe9de', export: { loudness: -14 } };

const ink = '#111111', paper = '#efe9de', acid = '#d9ff44', blue = '#3a35ed', white = '#f8f7f2';
const label = { fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const };

function Rule({ color = ink }: { color?: string }) { return <div style={{ height: 3, background: color, width: '100%' }} />; }

function Opening() {
  const frame = useCurrentFrame();
  const rise = springValue({ frame, delay: 6, preset: 'snappy' });
  const stamp = springValue({ frame, delay: 22, preset: 'smooth' });
  return <AbsoluteFill style={{ background: paper, color: ink, overflow: 'hidden', padding: '180px 54px' }}>
    <div style={{ ...label, fontSize: 24 }}>MotionRender / Skill Suite</div>
    <div style={{ position: 'absolute', top: 250, left: 54, transform: `translateY(${(1 - rise) * 82}px)`, opacity: Math.min(1, rise * 1.3), fontFamily: 'Arial Black, Inter, sans-serif', fontSize: 192, fontWeight: 950, lineHeight: 1, letterSpacing: '-0.09em' }}>24</div>
    <div style={{ position: 'absolute', top: 470, left: 66, transform: `translateY(${(1 - rise) * 82}px)`, opacity: Math.min(1, rise * 1.3), fontFamily: 'Arial Black, Inter, sans-serif', fontSize: 128, fontWeight: 950, lineHeight: 1, letterSpacing: '-0.085em' }}>WAYS</div>
    <div style={{ position: 'absolute', top: 670, left: 66, transform: `translateY(${(1 - rise) * 82}px)`, opacity: Math.min(1, rise * 1.3), fontFamily: 'Arial Black, Inter, sans-serif', fontSize: 128, fontWeight: 950, lineHeight: 1, letterSpacing: '-0.085em' }}>TO MOVE</div>
    <div style={{ position: 'absolute', top: 290, left: 935, width: 22, height: 600, background: acid, transform: `translateY(${Math.sin(frame * 0.08) * 34}px)` }} />
    <div style={{ position: 'absolute', left: 54, right: 54, bottom: 410 }}><Rule /><div style={{ paddingTop: 26 }}><div style={{ maxWidth: 560, fontSize: 32, lineHeight: 1.15, fontWeight: 650 }}>Specialist workflows for the part of video that actually matters.</div><div style={{ position: 'absolute', right: 150, bottom: 0, width: 154, height: 154, background: acid, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(${stamp * 18 + frame * 0.6}deg) scale(${0.7 + stamp * 0.3})`, fontSize: 24, fontWeight: 900 }}>FX</div></div></div>
  </AbsoluteFill>;
}

const lanes = [
  ['REFERENCE', 'SEE THE RHYTHM'],
  ['PRODUCT', 'SHOW THE PROOF'],
  ['DATA', 'KEEP IT TRUE'],
  ['CRAFT', 'MAKE IT LAND'],
] as const;

function Lanes() {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: blue, color: white, padding: '180px 0', overflow: 'hidden' }}>
    <div style={{ ...label, fontSize: 24, padding: '0 54px' }}>Choose a discipline / 02</div>
    <div style={{ marginTop: 92 }}>
      {lanes.map(([name, purpose], index) => {
        const local = Math.max(0, Math.min(1, (frame - 10 - index * 14) / 22));
        const x = (1 - springValue({ frame, delay: 10 + index * 14, preset: 'snappy' })) * (index % 2 ? -220 : 220);
        return <div key={name} style={{ borderTop: `2px solid rgba(248,247,242,${0.85 - index * 0.1})`, padding: '26px 54px 22px', transform: `translateX(${x}px)`, opacity: Math.min(1, local * 1.35), display: 'flex', alignItems: 'baseline', gap: 22 }}><div style={{ color: acid, fontSize: 24, fontWeight: 900, width: 54 }}>0{index + 1}</div><div><div style={{ fontFamily: 'Arial Black, Inter, sans-serif', fontSize: 64, lineHeight: 1, letterSpacing: '-0.065em' }}>{name}</div><div style={{ ...label, fontSize: 24, color: acid, marginTop: 12 }}>{purpose}</div></div></div>;
      })}
      <div style={{ borderTop: '2px solid rgba(248,247,242,.55)' }} />
    </div>
    <div style={{ position: 'absolute', bottom: 410, left: 54, right: 54 }}><div style={{ fontSize: 32, fontWeight: 650, maxWidth: 550, lineHeight: 1.1 }}>One engine. A sharper route to the frame.</div></div>
  </AbsoluteFill>;
}

function Closing() {
  const frame = useCurrentFrame();
  const settle = springValue({ frame, delay: 8, preset: 'smooth' });
  return <AbsoluteFill style={{ background: ink, color: paper, padding: '180px 54px', overflow: 'hidden' }}>
    <div style={{ ...label, fontSize: 24, color: acid }}>03 / 03 — FINAL FRAME</div>
    <div style={{ position: 'absolute', top: 330, left: 38, opacity: Math.min(1, settle * 1.25), transform: `translateY(${(1 - settle) * 54}px)`, fontFamily: 'Arial Black, Inter, sans-serif', fontSize: 128, lineHeight: 1, letterSpacing: '-0.09em' }}>DESIGN</div>
    <div style={{ position: 'absolute', top: 540, left: 38, opacity: Math.min(1, settle * 1.25), transform: `translateY(${(1 - settle) * 54}px)`, fontFamily: 'Arial Black, Inter, sans-serif', fontSize: 128, lineHeight: 1, letterSpacing: '-0.09em' }}>WITH</div>
    <div style={{ position: 'absolute', top: 790, left: 38, opacity: Math.min(1, settle * 1.25), transform: `translateY(${(1 - settle) * 54}px)`, fontFamily: 'Arial Black, Inter, sans-serif', fontSize: 192, lineHeight: 1, letterSpacing: '-0.1em', color: acid }}>INTENT.</div>
    <div style={{ position: 'absolute', left: 54, right: 54, bottom: 410 }}><Rule color={acid} /><div style={{ paddingTop: 26 }}><div style={{ fontSize: 32, fontWeight: 650, lineHeight: 1.12, maxWidth: 560 }}>Make the motion mean something.</div><div style={{ ...label, fontSize: 24, color: acid, marginTop: 24 }}>MotionRender / 24 Skills</div></div></div>
  </AbsoluteFill>;
}

export default function Video() {
  return <AbsoluteFill><Sequence from={0} durationInFrames={120} fadeOut={10}><Audio src="sfx:whoosh" volume={0.3} /><Opening /></Sequence><Sequence from={120} durationInFrames={185}><Audio src="sfx:thump" volume={0.32} /><Lanes /></Sequence><Sequence from={305} durationInFrames={145}><Audio src="sfx:riser" volume={0.26} /><Closing /></Sequence></AbsoluteFill>;
}
