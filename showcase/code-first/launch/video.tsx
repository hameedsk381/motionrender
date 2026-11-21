// A product launch, wide (16:9): a hero, a bento of three cards, a call to action. "Lumen" is a made-up product.
import { AbsoluteFill, AmbientGlow, Badge, BentoCard, BentoGrid, NumberTicker, ProgressBar, Sequence, Waveform, springValue, useCurrentFrame } from 'motionrender/react';

export const config = { id: 'launch', name: 'Product launch', width: 1920, height: 1080, fps: 30, durationInFrames: 360, background: '#0a0c14' };

const font = 'Manrope, sans-serif', ink = '#f5f7ff', muted = '#8f98b8', accent = '#a78bfa', mint = '#5eead4';

function Hero() {
  const frame = useCurrentFrame();
  const sub = springValue({ frame, delay: 36, preset: 'smooth' }), rise = springValue({ frame, delay: 8, preset: 'smooth' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: font, color: ink, gap: 34 }}>
      <Badge delay={4} dotColor={mint} style={{ fontSize: 28, padding: '10px 22px', color: ink }}>New · Lumen 2.0</Badge>
      <div style={{ fontSize: 112, fontWeight: 800, textAlign: 'center', lineHeight: 1.04, maxWidth: 1400, opacity: Math.min(1, rise * 1.5), transform: `translateY(${(1 - rise) * 40}px)` }}>Analytics that explain themselves</div>
      <div style={{ fontSize: 40, color: muted, opacity: sub, transform: `translateY(${(1 - sub) * 24}px)` }}>Ask a question. Get the chart.</div>
    </AbsoluteFill>
  );
}

const card = { background: '#12162a', border: '1px solid #232a4a', borderRadius: 28, padding: 40, boxShadow: 'none' } as const;

function Bento() {
  return (
    <AbsoluteFill style={{ padding: '150px 160px', fontFamily: font, color: ink, justifyContent: 'center' }}>
      <div style={{ fontSize: 64, fontWeight: 800, marginBottom: 44 }}>One place for the answer</div>
      <BentoGrid columns={3} gap={32} style={{ height: 520 }}>
        <BentoCard delay={6} style={card} title={<span style={{ fontSize: 40, fontWeight: 700, color: ink }}>Live dashboards</span>} subtitle={<span style={{ fontSize: 28, color: muted }}>Every number, as it changes.</span>}>
          <div style={{ marginTop: 'auto' }}><ProgressBar value={0.82} delay={20} color={accent} height={18} /></div>
        </BentoCard>
        <BentoCard delay={16} style={card} title={<span style={{ fontSize: 40, fontWeight: 700, color: ink }}>Alerts</span>} subtitle={<span style={{ fontSize: 28, color: muted }}>Told before a customer is.</span>}>
          <div style={{ marginTop: 'auto', fontSize: 112, fontWeight: 800, color: mint }}><NumberTicker value={99.9} decimals={1} suffix="%" delay={26} /></div>
        </BentoCard>
        <BentoCard delay={26} style={card} title={<span style={{ fontSize: 40, fontWeight: 700, color: ink }}>Weekly reports</span>} subtitle={<span style={{ fontSize: 28, color: muted }}>Read aloud, if you like.</span>}>
          <div style={{ marginTop: 'auto' }}><Waveform bars={20} height={90} delay={36} color={accent} activeColor={mint} /></div>
        </BentoCard>
      </BentoGrid>
    </AbsoluteFill>
  );
}

function Cta() {
  const frame = useCurrentFrame();
  const p = springValue({ frame, delay: 4, preset: 'bouncy' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: font, color: ink, gap: 40 }}>
      <div style={{ fontSize: 112, fontWeight: 800, transform: `scale(${0.85 + 0.15 * p})`, opacity: Math.min(1, p * 2) }}>Try Lumen free</div>
      <div style={{ fontSize: 40, border: `4px solid ${accent}`, color: ink, fontWeight: 800, padding: '20px 52px', borderRadius: 999, opacity: Math.min(1, Math.max(0, (frame - 14) / 12)) }}>lumen.example</div>
    </AbsoluteFill>
  );
}

export default function Video() {
  return (
    <AbsoluteFill>
      <AmbientGlow blur={140} orbs={[{ x: '20%', y: '25%', size: 800, color: accent, opacity: 0.22, speed: 0.02 }, { x: '82%', y: '78%', size: 700, color: mint, opacity: 0.14, speed: 0.025, phase: 2 }]} />
      <Sequence from={0} durationInFrames={130}><Hero /></Sequence>
      <Sequence from={130} durationInFrames={150}><Bento /></Sequence>
      <Sequence from={280} durationInFrames={80}><Cta /></Sequence>
    </AbsoluteFill>
  );
}
