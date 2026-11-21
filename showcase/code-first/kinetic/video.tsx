// Kinetic type, vertical (9:16): one word per beat slams in on its own colour. Written as code; there is no composition.json.
import { AbsoluteFill, Sequence, springValue, useCurrentFrame } from 'motionrender/react';

export const config = { id: 'kinetic', name: 'Kinetic type', width: 1080, height: 1920, fps: 30, durationInFrames: 300, background: '#f4efe6' };

const BEAT = 75;
const beats = [
  { word: 'Write.', note: 'a component per scene', bg: '#f4efe6', ink: '#16130f', mark: '#e5484d' },
  { word: 'Render.', note: 'frame-exact, always', bg: '#16130f', ink: '#f4efe6', mark: '#f5c518' },
  { word: 'Review.', note: 'a contact sheet first', bg: '#e5484d', ink: '#fff7ee', mark: '#16130f' },
  { word: 'Ship.', note: 'mr render video.tsx', bg: '#f5c518', ink: '#16130f', mark: '#e5484d' },
];

function Beat({ word, note, bg, ink, mark }: typeof beats[number]) {
  const frame = useCurrentFrame();
  const slam = springValue({ frame, delay: 2, preset: 'bouncy' });
  const wipe = springValue({ frame, delay: 0, preset: 'smooth' });
  const noteIn = springValue({ frame, delay: 10, preset: 'snappy' });
  return (
    <AbsoluteFill style={{ background: bg, alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, sans-serif', color: ink, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 28, width: `${wipe * 100}%`, background: mark }} />
      <div style={{ fontSize: 250, fontWeight: 800, letterSpacing: -8, transform: `scale(${1.5 - 0.5 * slam}) rotate(${(1 - slam) * -6}deg)`, opacity: Math.min(1, slam * 2) }}>{word}</div>
      <div style={{ fontSize: 48, fontWeight: 500, marginTop: 40, opacity: noteIn, transform: `translateY(${(1 - noteIn) * 30}px)` }}>{note}</div>
      <div style={{ position: 'absolute', bottom: 150, fontSize: 30, letterSpacing: 6, fontWeight: 600, opacity: 0.7 }}>MOTIONRENDER</div>
    </AbsoluteFill>
  );
}

export default function Video() {
  return (
    <AbsoluteFill>
      {beats.map((beat, i) => <Sequence key={beat.word} from={i * BEAT} durationInFrames={BEAT}><Beat {...beat} /></Sequence>)}
    </AbsoluteFill>
  );
}
