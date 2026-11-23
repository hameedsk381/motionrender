import { describe, expect, it } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useTimeline } from '@ove/react';
import { selfClockedLibraries } from '../../packages/cli/src/own-clock';

// useTimeline seeks a library's paused timeline to the frame, so GSAP plays by the frame instead of the wall clock.
const shared = (globalThis as any).__oveReact as { frame: any; config: any };
const config = { id: 't', width: 640, height: 360, fps: 30, durationInFrames: 150 };
const at = (frame: number, node: ReactNode) => renderToStaticMarkup(createElement(shared.config.Provider, { value: config }, createElement(shared.frame.Provider, { value: frame }, node)));

describe('useTimeline', () => {
  it('builds the timeline on the values once and seeks it to the frame, in seconds', () => {
    const seeks: number[] = [];
    let builds = 0;
    const Probe = () => {
      const state = useTimeline({ x: 0 }, s => { builds++; s.x = 7; return { seek: (time: number) => { seeks.push(time); } }; });
      return createElement('span', null, String(state.x));
    };
    expect(at(15, createElement(Probe))).toContain('7');
    expect(seeks).toEqual([0.5]);
    expect(builds).toBe(1);
    at(45, createElement(Probe));
    expect(seeks).toEqual([0.5, 1.5]);
  });
  it('seeks in milliseconds for a timeline that takes them', () => {
    const seeks: number[] = [];
    const Probe = () => { useTimeline({}, () => ({ seek: (time: number) => { seeks.push(time); } }), { unit: 'ms' }); return null; };
    at(15, createElement(Probe));
    expect(seeks).toEqual([500]);
  });
  it('does not warn about GSAP in a video that seeks it with useTimeline', () => {
    const inputs = ['node_modules/gsap/gsap-core.js'];
    expect(selfClockedLibraries(inputs, 'const s = useTimeline({ x: 0 }, s => gsap.timeline())')).toEqual([]);
    expect(selfClockedLibraries(inputs, 'gsap.to(box, { x: 100 })')).toHaveLength(1);
    expect(selfClockedLibraries(['node_modules/framer-motion/dist/a.mjs'], 'useTimeline(')).toHaveLength(1);
  });
});
