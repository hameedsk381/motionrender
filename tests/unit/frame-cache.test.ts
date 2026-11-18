import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cachedSceneFrames, compileVideoPlan } from '@ove/core';

it('reuses unchanged primitive scene frames and invalidates edits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mr-frame-cache-'));
  try {
    const composition = compileVideoPlan({ id: 'cache', name: 'Cache', brief: { prompt: 'Cache test' }, beats: [{ id: 'a', intent: 'Hook', onScreen: 'Hello', durationSeconds: 2 }] }).composition;
    let calls = 0;
    const renderer = { concurrency: 1, async renderFrame() { calls++; return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, calls]); } };
    const first = cachedSceneFrames(renderer, composition, directory, 'test-renderer');
    await first.renderFrame(10);
    await cachedSceneFrames(renderer, composition, directory, 'test-renderer').renderFrame(10);
    expect(calls).toBe(1);
    (composition.scenes[0]!.layers[0] as any).content = 'New copy';
    await cachedSceneFrames(renderer, composition, directory, 'test-renderer').renderFrame(10);
    expect(calls).toBe(2);
    await cachedSceneFrames(renderer, composition, directory, 'new-renderer').renderFrame(10);
    expect(calls).toBe(3);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
