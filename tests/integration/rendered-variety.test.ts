import { expect, it } from 'vitest';
import { compareRenderedVariety, loadComposition } from '@ove/core';

const make = (background = '#ffffff', color = '#000000', y = 100, blank = false) => loadComposition({ version: '1.0', id: 'test', name: 'test', width: 640, height: 360, fps: 30, durationFrames: 90, background, scenes: [{ id: 'main', name: 'Main', startFrame: 0, durationFrames: 90, layers: blank ? [] : [{ id: 'headline', type: 'text', content: 'OPEN', x: 60, y, fontSize: 80, fontFamily: 'Inter', color }] }] });
const options = { baseDirA: process.cwd(), baseDirB: process.cwd(), samples: 3 };

it('detects palette-only repeats but distinguishes moved content', async () => {
  const base = make();
  const same = await compareRenderedVariety(base, base, options);
  expect(same.verdict).toBe('likely-repeated'); expect(same.edgeSimilarity).toBe(1);
  const palette = await compareRenderedVariety(base, make('#000000', '#ffffff'), options);
  expect(palette.verdict).toBe('likely-repeated'); expect(palette.pixelSimilarity).toBeLessThan(.5);
  const moved = await compareRenderedVariety(base, make('#ffffff', '#000000', 230), options);
  expect(moved.verdict).toBe('different-samples');
});
it('does not count matching blank videos as evidence of composition', async () => {
  const blank = make('#ffffff', '#000000', 100, true);
  expect((await compareRenderedVariety(blank, blank, options)).verdict).toBe('inconclusive');
});
