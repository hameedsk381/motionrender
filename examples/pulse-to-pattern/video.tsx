import { AbsoluteFill, Audio, useCurrentFrame } from 'motionrender/react';
import samples from './samples.json';

export const config = {
  id: 'pulse-to-pattern', name: 'From Pulse to Pattern',
  width: 1440, height: 1440, fps: 60, durationInFrames: 720, background: '#f5f0e6',
  export: { loudness: -16 },
};

const paper = '#f5f0e6';
const ink = '#211c19';
const accent = '#bd3324';
const count = samples.length;
const span = 1092;
const unit = 3.1;
const tau = 2 * Math.PI;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => { const p = clamp(x); return p*p*p*(10+p*(-15+6*p)); };
const ramp = (time: number, start: number, end: number) => ease((time-start)/(end-start));

function marks(curvature: number) {
  const arc = -tau * curvature;
  return samples.map((value, index) => {
    const along = (index / count - .5) * span + span / count / 2;
    const angle = arc * along / span;
    const radius = arc ? span / arc : 0;
    const x = 720 + (arc ? radius * Math.sin(angle) : along);
    const y = 882 - (arc ? radius * 2 * Math.sin(angle/2)**2 : 0) - 292 * curvature;
    const length = value * unit;
    return {
      value, x, y, angle, length,
      topX: x - Math.sin(angle) * length,
      topY: y - Math.cos(angle) * length,
    };
  });
}

export default function PulseToPattern() {
  const frame = useCurrentFrame();
  const t = Math.min(frame, 719) / 60;
  const split = ramp(t,2,3.2) * (1-ramp(t,10.7,11.76));
  const curvature = ramp(t,6,7.55) * (1-ramp(t,10,11.4));
  const points = marks(curvature);
  const crest = points.map(p => `${p.topX},${p.topY}`).join(' ');
  const active = Math.floor(t * 4) % count;
  const scan = ramp(t,.25,.8) * (1-ramp(t,11.22,11.78));
  const caption = t<2.6 || t>=11.1 ? 'SIGNAL' : t<6.8 || t>=10.65 ? 'BARS' : 'RADIAL';
  const captionAlpha = [2.6,6.8,10.65,11.1].reduce((a,cut)=>Math.min(a,ease(Math.abs(t-cut)/.14)),1);
  return <AbsoluteFill style={{ background: paper }}>
    <Audio src="./score.wav" />
    <svg width="1440" height="1440" viewBox="0 0 1440 1440" role="img"
      aria-label="24 synthetic samples shown as a line, vertical bars, and radial bars">
      <g fill={ink} fontFamily="Arial, sans-serif">
        <text x="140" y="242" fontSize="88" fontWeight="750" letterSpacing="-5.5">From Pulse</text>
        <text x="142" y="331" fontSize="88" fontWeight="750" letterSpacing="-5.5">to Pattern.</text>
        <text x="1300" y="242" textAnchor="end" fill={accent} fontSize="30" fontWeight="700" letterSpacing="3" opacity={captionAlpha}>{caption}</text>
        <text x="1300" y="282" textAnchor="end" fontSize="30">24 synthetic samples</text>
      </g>
      <path d="M142 387H1298M142 1155H1298" stroke={ink} strokeWidth="2" />
      <polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={ink} strokeOpacity=".23" strokeWidth="2" />
      <polyline points={crest} fill="none" stroke={ink} strokeWidth="7"
        strokeLinejoin="round" strokeLinecap="round" opacity={1-split} />
      {points.map((p,index)=>{
        const amount = clamp(split*1.28-index*.011);
        const focus = index===active ? scan : 0;
        return <g key={index} data-value={p.value}>
          <line x1={p.x} y1={p.y} x2={p.topX} y2={p.topY}
            stroke={focus>.5 ? accent : ink} strokeWidth={6+amount*14} opacity={amount} />
          <circle cx={p.topX} cy={p.topY} r={4+5*focus} fill={accent} opacity={focus} />
        </g>;
      })}
      <g fontFamily="Arial, sans-serif" fontSize="30" fill={ink} fontWeight="600">
        <text x="142" y="1216">AMPLITUDE · ARBITRARY UNITS</text>
        <text x="1298" y="1216" textAnchor="end">120 BPM</text>
      </g>
    </svg>
  </AbsoluteFill>;
}
