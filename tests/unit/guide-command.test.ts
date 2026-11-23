import { describe, expect, it } from 'vitest';
import { readGuides } from '../../packages/cli/src/guide-command';

// `mr guide` prints the craft guides that ship with the package: the floor every video is held to and how to lay one out, picture it, narrate it and move it.
describe('craft guides', () => {
  it('ships the six guides, each a titled page', async () => {
    const guides = await readGuides();
    expect(guides.map(guide => guide.name)).toEqual(['floor', 'layout', 'libraries', 'motion', 'narration', 'pictures']);
    for (const guide of guides) { expect(guide.title.length, guide.name).toBeGreaterThan(8); expect(guide.text.length, guide.name).toBeGreaterThan(400); expect(guide.text.startsWith(`# ${guide.name}:`), guide.name).toBe(true); }
  });

  it('states the floor the review enforces, with its numbers', async () => {
    const floor = (await readGuides()).find(guide => guide.name === 'floor')!.text;
    for (const rule of [/24 px/, /26 px/, /lineHeight.*1\.2/, /5 to 8 sizes/, /40 words/, /3:1/, /top 8%.*bottom 18%.*right 11%/, /config\.assets/, /export\.loudness/, /image-missing/]) expect(floor).toMatch(rule);
  });

  it('points at the commands each guide depends on, which exist', async () => {
    const text = (await readGuides()).map(guide => guide.text).join('\n');
    for (const command of ['mr stock', 'mr voice', 'mr explainer outline']) expect(text).toContain(command);
  });
});
