import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadComposition } from '@ove/schema';
import { checkRenderDiskSpace, diskSpaceProblem, freeBytes, renderMedia } from '../../packages/core/src';

// A render on a nearly full drive used to fail minutes in with a bare ENOSPC. It now checks first and says what to do.
const saved = process.env.OVE_MIN_FREE_MB;
afterEach(() => { if (saved === undefined) delete process.env.OVE_MIN_FREE_MB; else process.env.OVE_MIN_FREE_MB = saved; });

describe('free disk space', () => {
  it('reads the free space of a drive, even for a folder that does not exist yet', async () => {
    expect(await freeBytes(tmpdir())).toBeGreaterThan(0);
    expect(await freeBytes(join(tmpdir(), 'does', 'not', 'exist', 'yet'))).toBeGreaterThan(0);
  });

  it('says how much is free, what is needed and what to do when there is not enough', async () => {
    const message = await diskSpaceProblem(tmpdir(), Number.MAX_SAFE_INTEGER, 'this render');
    expect(message).toMatch(/^Only \d+ MB is free on .* \(this render needs \d+ MB\)/);
    expect(message).toMatch(/another drive.*TEMP and TMP/);
    expect(await diskSpaceProblem(tmpdir(), 1, 'this render')).toBeUndefined();
  });

  it('can be raised, lowered or switched off with OVE_MIN_FREE_MB', async () => {
    await expect(checkRenderDiskSpace(tmpdir(), { OVE_MIN_FREE_MB: '999999999' })).rejects.toThrow(/Only \d+ MB is free/);
    await expect(checkRenderDiskSpace(tmpdir(), { OVE_MIN_FREE_MB: '0' })).resolves.toBeUndefined();
    await expect(checkRenderDiskSpace(tmpdir(), { OVE_MIN_FREE_MB: '1' })).resolves.toBeUndefined();
  });

  it('stops a render before it starts, so nothing is drawn on a full drive', async () => {
    process.env.OVE_MIN_FREE_MB = '999999999';
    const composition = loadComposition({ version: '1.0', id: 't', name: 'T', width: 320, height: 240, fps: 30, durationFrames: 30, scenes: [{ id: 'a', name: 'A', durationFrames: 30, layers: [] }] });
    const dir = mkdtempSync(join(tmpdir(), 'ove-disk-'));
    try { await expect(renderMedia(composition, { baseDir: dir, output: join(dir, 'out.mp4') })).rejects.toThrow(/Only \d+ MB is free/); } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
