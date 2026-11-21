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

// A video can pass every other check and still look empty: the review says how much of the usable height the picture fills.
describe('make on a video that fills little of the frame', () => {
  const film = (body: string) => `import { AbsoluteFill } from 'motionrender/react';
export const config = { id: 'fill', width: 540, height: 960, fps: 30, durationInFrames: 120, background: '#f4efe4', export: { loudness: -16 } };
export default function Video() { return <AbsoluteFill style={{ fontFamily: 'Inter, sans-serif', color: '#1b1b1b' }}>${body}</AbsoluteFill>; }
`;
  const project = async (name: string, body: string) => { const root = join(dir, name); await mkdir(root, { recursive: true }); await writeFile(join(root, 'video.tsx'), film(body)); return join(root, 'video.tsx'); };

  it('notes a picture that uses only a small part of the usable height', async () => {
    const result = await makeVideo({ file: await project('sparse', `<div style={{ position: 'absolute', left: 40, top: 200, fontSize: 56, fontWeight: 700, lineHeight: 1.2 }}>A small title</div>`), every: 15 });
    expect(makeReport(result)).toMatch(/note .*fills only about \d+% of the usable height/);
  }, 240_000);

  it('is quiet about a picture that fills it', async () => {
    const body = `<div style={{ position: 'absolute', left: 40, top: 100, fontSize: 64, fontWeight: 700, lineHeight: 1.2 }}>A title that opens the frame</div><div style={{ position: 'absolute', left: 40, top: 400, width: 460, height: 340, background: '#c8402b' }} /><div style={{ position: 'absolute', left: 40, top: 760, fontSize: 56, fontWeight: 700, lineHeight: 1.2 }}>and a closing line</div>`;
    const result = await makeVideo({ file: await project('full', body), every: 15 });
    expect(makeReport(result)).not.toMatch(/fills only about/);
  }, 240_000);
});

// Frame 0 is often the thumbnail: the review says when it is only the background.
describe('make on a video whose first frame is empty', () => {
  const film = (body: string) => `import { AbsoluteFill, useCurrentFrame } from 'motionrender/react';
export const config = { id: 'first', width: 540, height: 960, fps: 30, durationInFrames: 90, background: '#f4efe4', export: { loudness: -16 } };
export default function Video() { const frame = useCurrentFrame(); return <AbsoluteFill style={{ fontFamily: 'Inter, sans-serif', color: '#1b1b1b' }}>${body}</AbsoluteFill>; }
`;
  const project = async (name: string, body: string) => { const root = join(dir, name); await mkdir(root, { recursive: true }); await writeFile(join(root, 'video.tsx'), film(body)); return join(root, 'video.tsx'); };
  const title = (opacity: string) => `<div style={{ position: 'absolute', left: 40, top: 360, fontSize: 64, fontWeight: 700, lineHeight: 1.2, opacity: ${opacity} }}>The hero is here</div>`;

  it('notes a first frame that is only the background', async () => {
    const result = await makeVideo({ file: await project('empty-first', title('frame < 12 ? 0 : 1')), every: 15 });
    expect(makeReport(result)).toMatch(/note .*Frame 0 is only the background/);
  }, 240_000);

  it('is quiet when the hero is already in view on frame 0', async () => {
    const result = await makeVideo({ file: await project('full-first', title('1')), every: 15 });
    expect(makeReport(result)).not.toMatch(/Frame 0 is only the background/);
  }, 240_000);
});

// Motion assertions: requirements a video declares about its own timeline in video.motion.json, judged by the review on the real frames.
describe('make with motion assertions', () => {
  const film = `import { AbsoluteFill, useCurrentFrame } from 'motionrender/react';
export const config = { id: 'motion', width: 540, height: 960, fps: 30, durationInFrames: 120, background: '#f4efe4', export: { loudness: -16 } };
export default function Video() { const f = useCurrentFrame(); const t = { position: 'absolute' as const, fontSize: 56, fontWeight: 700, lineHeight: 1.2, left: 40 };
  return <AbsoluteFill style={{ fontFamily: 'Inter, sans-serif', color: '#1b1b1b' }}>
    <div style={{ ...t, top: 120 }}>Early title</div>
    <div style={{ ...t, top: 360, opacity: f < 45 ? 0 : 1 }}>Late title</div>
    <div style={{ ...t, top: 600, left: 40 + f * 7 }}>Slider text</div>
  </AbsoluteFill>; }
`;
  const project = async (name: string, assertions: object[], source = film) => {
    const root = join(dir, name); await mkdir(root, { recursive: true });
    await writeFile(join(root, 'video.tsx'), source); await writeFile(join(root, 'video.motion.json'), JSON.stringify({ assertions }));
    return join(root, 'video.tsx');
  };

  it('is quiet when every assertion holds, and says it checked them', async () => {
    const result = await makeVideo({ file: await project('holds', [{ appearsBy: { text: 'Early title', seconds: 0.5 } }, { before: { first: 'Early title', then: 'Late title' } }]), every: 15 });
    expect(makeReport(result)).not.toMatch(/must be in view by|must come before|leaves the frame at|is never in view/);   // (the film's slider runs off the edge on purpose, which the ordinary review reports)
    expect(makeReport(result)).toMatch(/Checking 2 motion assertions from video\.motion\.json/);
  }, 240_000);

  it('fails an appearsBy deadline, an order that is the wrong way round, and text that leaves the frame', async () => {
    const result = await makeVideo({ file: await project('breaks', [{ appearsBy: { text: 'Late title', seconds: 1 } }, { before: { first: 'Late title', then: 'Early title' } }, { staysInFrame: { text: 'Slider text' } }]), every: 15 });
    const report = makeReport(result);
    expect(result.ok).toBe(false);
    expect(report).toMatch(/"Late title" must be in view by 1\.0 s but first is at 1\.\d s/);
    expect(report).toMatch(/"Late title" must come before "Early title"/);
    expect(report).toMatch(/"Slider text" leaves the frame at \d\.\d s/);
  }, 240_000);

  it('fails a picture that stands still for longer than allowed', async () => {
    const still = film.replace('left: 40 + f * 7', 'left: 40').replace("opacity: f < 45 ? 0 : 1", 'opacity: 1');
    const result = await makeVideo({ file: await project('still', [{ keepsMoving: { from: 0.5, to: 3.5, every: 1 } }], still), every: 15 });
    expect(makeReport(result)).toMatch(/The picture does not change from .* longer than the 1 s allowed/);
  }, 240_000);

  it('names what is wrong with a motion file instead of ignoring it', async () => {
    const source = await project('bad', [{ appearsBy: { text: 'Early title' } }]);
    expect(makeReport(await makeVideo({ file: source, every: 30 }))).toMatch(/Motion assertions not used: motion assertion 1: appearsBy needs either "seconds" or "frame"/);
  }, 240_000);
});
