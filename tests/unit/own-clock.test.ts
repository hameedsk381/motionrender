import { describe, expect, it } from 'vitest';
import { selfClockedLibraries } from '../../packages/cli/src/own-clock';
import { readGuides } from '../../packages/cli/src/guide-command';

// A library that animates on a clock of its own stays at its first state in a frame-driven render, with no error: the build names the known ones.
describe('self-clocked libraries', () => {
  it('names framer-motion, also through a pnpm path or a Windows path', () => {
    expect(selfClockedLibraries(['../node_modules/framer-motion/dist/es/index.mjs'])[0]).toMatch(/framer-motion.*useMotionValue/);
    expect(selfClockedLibraries(['..\\node_modules\\.pnpm\\framer-motion@14.14.0\\node_modules\\framer-motion\\dist\\x.mjs'])).toHaveLength(1);
  });
  it('names react-spring, gsap and a Lottie player, once each', () => {
    const warnings = selfClockedLibraries(['node_modules/@react-spring/web/dist/a.js', 'node_modules/@react-spring/core/dist/b.js', 'node_modules/gsap/gsap-core.js', 'node_modules/lottie-react/build/index.js']);
    expect(warnings).toHaveLength(3);
    expect(warnings.every(warning => warning.includes('mr guide libraries'))).toBe(true);
  });
  it('stays quiet for libraries that are pure or that the frame can drive', () => {
    expect(selfClockedLibraries(['node_modules/d3-shape/src/line.js', 'node_modules/recharts/es6/chart/LineChart.js', 'node_modules/react/index.js', 'src/video.tsx'])).toEqual([]);
  });
  it('is explained in the libraries guide, with what was checked', async () => {
    const text = (await readGuides()).find(guide => guide.name === 'libraries')!.text;
    for (const rule of [/d3-shape/, /isAnimationActive=\{false\}/, /useMotionValue/, /One copy of React/, /delayRender/, /not tried yet/i]) expect(text).toMatch(rule);
  });
});
