import { AbsoluteFill, useCurrentFrame } from '@ove/react';

export const config = { id: 'custom-scene', width: 640, height: 360, fps: 30, durationInFrames: 60 };
export default function Scene({ beat }: { beat?: { onScreen?: string } }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: '#10242a', color: '#fff', justifyContent: 'center', alignItems: 'center', fontSize: 42, fontFamily: 'sans-serif' }}>
    <div style={{ opacity: Math.min(1, frame / 15), transform: `translateY(${Math.max(0, 20 - frame)}px)` }}>{beat?.onScreen ?? 'Scenes from code'}</div>
  </AbsoluteFill>;
}
