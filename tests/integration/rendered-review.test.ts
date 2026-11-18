import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ensureFfmpeg, ffmpegPath, reviewRenderedVideo } from '@ove/core';

it('finds black and frozen encoded output, missing audio and wrong duration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mr-encoded-review-'));
  try {
    await ensureFfmpeg(); const file = join(dir, 'black.mp4');
    await promisify(execFile)(ffmpegPath(), ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=160x90:r=10:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
    const report = await reviewRenderedVideo(file, { requireAudio: true, expectedDurationSeconds: 6 });
    expect(report.creativeQuality).toBe('unassessed');
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['black-gap', 'render-frozen', 'missing-audio', 'render-duration']));
    expect(report.width).toBe(160);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
