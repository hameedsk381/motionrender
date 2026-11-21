// A code walkthrough, wide (16:9): the editor card steps through the lines that matter while a terminal shows what they do.
// The card is drawn at real sizes (code 36 px), so it reads on a phone and the design review can see it.
import { AbsoluteFill, Sequence, springValue, useCurrentFrame } from 'motionrender/react';

export const config = { id: 'code', name: 'Code walkthrough', width: 1920, height: 1080, fps: 30, durationInFrames: 360, background: '#0d1117' };

const lines = [
  'function debounce(fn, ms) {',
  '  let timer;',
  '  return (...args) => {',
  '    clearTimeout(timer);',
  '    timer = setTimeout(() => fn(...args), ms);',
  '  };',
  '}',
];
const notes = ['Remember one timer.', 'Each call cancels the last.', 'Then starts a fresh wait.'];
const steps = [{ line: 2, from: 40 }, { line: 4, from: 130 }, { line: 5, from: 220 }];
// The terminal's lines appear whole, one at a time: typed text changes every frame, which the review reads as text that is on screen for no time at all.
const terminal = [{ at: 0, text: '$ demo.js' }, { at: 160, text: '> type "h"' }, { at: 200, text: '> type "he"' }, { at: 250, text: '> search("he") ran once' }];
const ink = '#e6edf3', muted = '#8b949e', accent = '#7ee787', mono = '"JetBrains Mono", monospace';

function Walkthrough() {
  const frame = useCurrentFrame();
  const current = [...steps].reverse().find(step => frame >= step.from);
  const index = current ? steps.indexOf(current) : -1;
  const note = springValue({ frame: frame - (current?.from ?? 0), preset: 'snappy' });
  return (
    <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', padding: '0 110px', gap: 70, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 1080 }}>
        <div style={{ fontSize: 30, letterSpacing: 6, color: accent, fontWeight: 700, marginBottom: 24 }}>DEBOUNCE</div>
        <div style={{ background: '#161b22', border: '2px solid #30363d', borderRadius: 24, overflow: 'hidden', opacity: Math.min(1, springValue({ frame, delay: 2, preset: 'snappy' }) * 1.4) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 28px', background: '#0d1117', borderBottom: '2px solid #30363d' }}>
            {['#ff5d6c', '#e8a548', '#3fae8c'].map(color => <span key={color} style={{ width: 18, height: 18, borderRadius: 9, background: color }} />)}
            <span style={{ flex: 1, textAlign: 'center', fontFamily: mono, fontSize: 26, color: muted }}>debounce.js</span>
          </div>
          <div style={{ padding: '22px 0' }}>
            {lines.map((line, k) => {
              const lit = current?.line === k + 1;
              return (
                <div key={k} style={{ padding: '4px 28px', background: lit ? 'rgba(126, 231, 135, 0.14)' : 'transparent', borderLeft: `6px solid ${lit ? accent : 'transparent'}` }}>
                  <span style={{ fontFamily: mono, fontSize: 36, lineHeight: 1.55, whiteSpace: 'pre', color: ink }}>{line}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 50 }}>
        <div style={{ minHeight: 140, fontSize: 56, fontWeight: 700, color: ink, opacity: index < 0 ? 0 : Math.min(1, note * 1.5), transform: `translateY(${(1 - note) * 24}px)` }}>{index >= 0 ? notes[index] : ''}</div>
        <div style={{ background: '#010409', border: '2px solid #30363d', borderRadius: 20, padding: '30px 36px', fontFamily: mono, fontSize: 30, lineHeight: 1.7, color: ink, minHeight: 300 }}>
          {terminal.map(line => <div key={line.text} style={{ opacity: Math.min(1, Math.max(0, (frame - line.at) / 8)), color: line.text.includes('ran once') ? accent : ink }}>{line.text}</div>)}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export default function Video() {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={360}><Walkthrough /></Sequence>
    </AbsoluteFill>
  );
}
