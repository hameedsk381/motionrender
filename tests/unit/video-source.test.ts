import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildVideoSource, isVideoSource } from '../../packages/cli/src/build';
import { initProject, starterReactDir } from '../../packages/cli/src/init';

// A video is written as code (video.tsx). Commands take the .tsx itself; the build keeps its work in a hidden .motionrender/ folder beside it, so the
// project holds no composition.json.
let dir = '';
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mr-source-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('a video source', () => {
  it('is a .tsx or .jsx file, not a composition or a script', () => {
    for (const yes of ['video.tsx', 'a/b/Video.JSX', 'C:\\x\\video.tsx']) expect(isVideoSource(yes), yes).toBe(true);
    for (const no of ['composition.json', 'explainer.json', 'plan.md', 'video.ts', 'video.tsx.json']) expect(isVideoSource(no), no).toBe(false);
  });

  it('is built into .motionrender beside it, with the bundle pointed at from there and nothing written next to the source', async () => {
    copyFileSync(join(starterReactDir, 'video.tsx'), join(dir, 'video.tsx'));
    const built = await buildVideoSource(join(dir, 'video.tsx'));
    expect(built.baseDir).toBe(dir);
    expect(built.compositionPath).toBe(join(dir, '.motionrender', 'composition.json'));
    const layers = (built.raw.scenes as any[]).flatMap(scene => scene.layers as any[]);
    const react = layers.find(layer => layer.type === 'react');
    expect(react.src).toBe('.motionrender/video.bundle.js');
    expect(existsSync(join(dir, '.motionrender', 'video.bundle.js'))).toBe(true);
    expect(existsSync(join(dir, 'composition.json'))).toBe(false);
    expect(built.raw).toMatchObject({ width: 1920, height: 1080, fps: 30, durationFrames: 300 });
  }, 60000);

  it('says what is wrong with a source that does not build', async () => {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(dir, 'video.tsx'), 'export default function Video() { return <div>; }\n');
    await expect(buildVideoSource(join(dir, 'video.tsx'))).rejects.toThrow();
  }, 60000);
});

describe('a new code-first project (mr init --react)', () => {
  it('starts with video.tsx and a git ignore for the hidden folder, and no composition.json', async () => {
    const files = await initProject(join(dir, 'p'), { react: true, skill: false });
    expect(files).toContain('video.tsx');
    expect(files).toContain('.gitignore');
    expect(files.some(file => file.endsWith('composition.json'))).toBe(false);
    expect(readFileSync(join(dir, 'p', '.gitignore'), 'utf8')).toContain('.motionrender/');
    expect(readFileSync(join(dir, 'p', 'video.tsx'), 'utf8')).toContain("from 'motionrender/react'");
  });

  it('still starts with a composition.json when asked for the older way', async () => {
    const files = await initProject(join(dir, 'q'), { skill: false });
    expect(files).toContain('composition.json');
    expect(files).not.toContain('video.tsx');
  });

  it('builds the starter it writes', async () => {
    await initProject(join(dir, 'r'), { react: true, skill: false });
    const built = await buildVideoSource(join(dir, 'r', 'video.tsx'));
    expect(built.raw.durationFrames).toBe(300);
  }, 60000);
});
