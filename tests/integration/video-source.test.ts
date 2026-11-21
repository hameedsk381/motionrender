import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeReport, makeVideo } from '../../packages/cli/src/make';
import { starterReactDir } from '../../packages/cli/src/init';

// The one-call loop on a video written as code: `make video.tsx` builds it, reviews it and draws the contact sheet, with no composition.json in the project.
let dir = '';
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'ove-source-')); await copyFile(join(starterReactDir, 'video.tsx'), join(dir, 'video.tsx')); });
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('make on a video source', () => {
  it('builds the .tsx, reviews it and draws one contact sheet, keeping its work in .motionrender', async () => {
    const result = await makeVideo({ file: join(dir, 'video.tsx'), every: 30 });
    expect(result.ok, makeReport(result)).toBe(true);
    expect(result.kind).toBe('source');
    expect(result.composition).toBe(join(dir, '.motionrender', 'composition.json'));
    expect(result.summary).toMatchObject({ width: 1920, height: 1080, seconds: 10 });
    expect((await stat(result.review!.sheet)).size).toBeGreaterThan(10_000);
    expect(existsSync(join(dir, 'composition.json'))).toBe(false);
    expect(makeReport(result)).toMatch(/Contact sheet of the whole video/);
  }, 240_000);

  it('renders a quick draft from it when asked', async () => {
    const result = await makeVideo({ file: join(dir, 'video.tsx'), every: 60, render: 'draft' });
    expect(result.ok).toBe(true);
    expect(result.video).toMatchObject({ draft: true });
    expect((await stat(result.video!.output)).size).toBeGreaterThan(1_000);
  }, 360_000);
});

// A picture the project does not hold renders as nothing and nothing else says so: the review has to.
describe('make on a video with a picture', () => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const video = (assets: string) => `import { AbsoluteFill, Img } from 'motionrender/react';
export const config = { id: 'pic', width: 540, height: 960, fps: 30, durationInFrames: 30, background: '#ffffff', export: { loudness: -16 }${assets} };
export default function Video() { return <AbsoluteFill><Img src="${assets ? 'pic' : 'assets/pic.png'}" style={{ width: '100%', height: '100%' }} /></AbsoluteFill>; }
`;
  const project = async (name: string, assets: string) => {
    const root = join(dir, name);
    await mkdir(join(root, 'assets'), { recursive: true });
    await writeFile(join(root, 'assets', 'pic.png'), PNG);
    await writeFile(join(root, 'video.tsx'), video(assets));
    return join(root, 'video.tsx');
  };

  it('reports a picture that is used but not declared in config.assets', async () => {
    const result = await makeVideo({ file: await project('undeclared', ''), every: 30 });
    expect(result.ok).toBe(false);
    expect(makeReport(result)).toMatch(/The picture "assets\/pic\.png" did not load.*config\.assets/);
  }, 240_000);

  it('is quiet about a picture that is declared and used by its id', async () => {
    const result = await makeVideo({ file: await project('declared', ", assets: [{ id: 'pic', type: 'image', src: 'assets/pic.png' }]"), every: 30 });
    expect(makeReport(result)).not.toMatch(/did not load/);
  }, 240_000);
});
