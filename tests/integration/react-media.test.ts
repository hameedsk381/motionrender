import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBuild } from '../../packages/cli/src/build';

// Audio and Video components become audio and video layers when the video is built; imported CSS is bundled with the component.
let dir = '', raw: any;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ove-media-'));
  await runBuild(['build', join(process.cwd(), 'tests/integration/fixtures/media-fixture.tsx'), '--output', join(dir, 'composition.json')]);
  raw = JSON.parse(await readFile(join(dir, 'composition.json'), 'utf8'));
}, 120_000);
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('Audio and Video components', () => {
  it('turn runs of frames into layers: footage under the component, sound after it', () => {
    const layers = raw.scenes[0].layers as any[];
    expect(layers.map(layer => layer.type)).toEqual(['video', 'react', 'video', 'audio', 'audio']);
    expect(layers[0]).toMatchObject({ src: 'clip', startFrame: 0, endFrame: 60, volume: 0.5, x: 0, y: 0, width: 320, height: 180, objectFit: 'cover' });
    expect(layers[2]).toMatchObject({ src: 'clip', width: 100, height: 60, x: 10, y: 10 });   // layer="front": above the component, moving with the frame
    const move = layers[2].animations.find((a: any) => a.property === 'x');
    expect(move.keyframes[0]).toEqual({ frame: 0, value: 10 }); expect(move.keyframes.at(-1)).toEqual({ frame: 59, value: 200 }); expect(layers[2].animations.some((a: any) => a.property === 'y')).toBe(false);
    expect(layers[3]).toMatchObject({ src: 'sfx:whoosh', startFrame: 0, endFrame: 60, volume: 1, trimStart: 0 });
    expect(layers[4]).toMatchObject({ src: 'sfx:ding', startFrame: 20, endFrame: 35, volume: 2, trimStart: 3 });
  });
  it('bundles imported CSS into the component bundle', async () => {
    const bundle = await readFile(join(dir, 'media-fixture.bundle.js'), 'utf8');
    expect(bundle).toContain('#123456'); expect(bundle).toContain('url(data:font/woff2');   // the font file went in as data
  });
  it('restarts identical sound cues in adjacent sequences and loop iterations', async () => {
    const source = join(dir, 'adjacent-audio.tsx'), output = join(dir, 'adjacent', 'composition.json');
    await writeFile(source, `import { Audio, Loop, Sequence } from '@ove/react';
export const config = { width: 320, height: 180, fps: 30, durationInFrames: 20 };
export default function Video() {
  return <>
    {[0, 5, 10].map(from => <Sequence key={from} from={from} durationInFrames={5}><Audio src="sfx:tick" /></Sequence>)}
    <Sequence from={15}><Loop durationInFrames={1} times={2}><Audio src="sfx:tick" /></Loop></Sequence>
    <Audio name="bed" src="sfx:whoosh" />
  </>;
}
`);
    await runBuild(['build', source, '--output', output]);
    const built = JSON.parse(await readFile(output, 'utf8'));
    const audio = built.scenes[0].layers.filter((layer: { type: string }) => layer.type === 'audio');
    expect(audio.filter((layer: { src: string }) => layer.src === 'sfx:tick').map(
      ({ startFrame, endFrame }: { startFrame: number; endFrame: number }) => [startFrame, endFrame],
    )).toEqual([[0, 5], [5, 10], [10, 15], [15, 16], [16, 17]]);
    expect(audio.filter((layer: { src: string }) => layer.src === 'sfx:whoosh')).toMatchObject([{ startFrame: 0, endFrame: 20 }]);
  });
  it('separates adjacent same-source cues that share a timeline origin', async () => {
    const source = join(dir, 'audio-identity.tsx'), output = join(dir, 'identity', 'composition.json');
    await writeFile(source, `import { AbsoluteFill, Audio, useCurrentFrame } from '@ove/react';
export const config = { width: 320, height: 180, fps: 30, durationInFrames: 10 };
export default function Video() {
  const frame = useCurrentFrame();
  return <>
    <AbsoluteFill from={0} durationInFrames={5}><Audio src="sfx:tick" /></AbsoluteFill>
    <AbsoluteFill from={5} durationInFrames={5}><Audio src="sfx:tick" /></AbsoluteFill>
    <Audio src="sfx:pop" name={frame < 5 ? 'first' : 'second'} />
  </>;
}
`);
    await runBuild(['build', source, '--output', output]);
    const built = JSON.parse(await readFile(output, 'utf8'));
    const audio = built.scenes[0].layers.filter((layer: { type: string }) => layer.type === 'audio');
    for (const src of ['sfx:tick', 'sfx:pop']) {
      expect(audio.filter((layer: { src: string }) => layer.src === src)).toMatchObject([
        { startFrame: 0, endFrame: 5 }, { startFrame: 5, endFrame: 10 },
      ]);
    }
  });
  it('refuses a file the project does not have, instead of failing at render', async () => {
    const fixture = join(dir, 'missing-media.tsx');
    await writeFile(fixture, `import { Audio } from '@ove/react';
export const config = { id: 'missing', width: 320, height: 180, fps: 30, durationInFrames: 30 };
export default function Video() { return <Audio src="audio/pad.mp3" />; }
`);
    await expect(runBuild(['build', fixture, '--output', join(dir, 'missing', 'composition.json')])).rejects.toThrow(/not in the project: audio\/pad\.mp3/);
  });

  it('says so when the component cannot be rendered in Node, and still builds', async () => {
    const warnings: string[] = []; const warn = console.warn; console.warn = (...args: unknown[]) => { warnings.push(args.join(' ')); };
    try { await runBuild(['build', join(process.cwd(), 'tests/integration/fixtures/window-fixture.tsx'), '--output', join(dir, 'win', 'composition.json')]); } finally { console.warn = warn; }
    expect(warnings.join(' ')).toMatch(/Audio and Video components were not read/);
    expect(JSON.parse(await readFile(join(dir, 'win', 'composition.json'), 'utf8')).scenes[0].layers.map((l: any) => l.type)).toEqual(['react']);
  });
});
