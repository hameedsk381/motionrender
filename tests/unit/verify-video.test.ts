import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureFfmpeg, ffmpegPath } from '@ove/ffmpeg';
import { verifyVideo } from '../../packages/cli/src/verify-video';

// The finished file is read, not the plan: size, length, sound, black and frozen stretches. These write small real MP4s with ffmpeg and check what comes back.
let dir = '';
const codes = (checks: { code: string }[]) => checks.map(check => check.code);
const make = (name: string, video: string, audio: string | undefined, seconds = 3) => {
  const file = join(dir, `${name}.mp4`);
  const args = ['-y', '-f', 'lavfi', '-i', `${video}:duration=${seconds}`, ...(audio ? ['-f', 'lavfi', '-i', `${audio}:duration=${seconds}`] : []), '-pix_fmt', 'yuv420p', '-shortest', file];
  const run = spawnSync(ffmpegPath(), args, { stdio: 'ignore' });
  if (run.status !== 0) throw new Error(`ffmpeg failed to make ${name}`);
  return file;
};
const want = { width: 320, height: 240, seconds: 3, audio: true };
beforeAll(async () => { await ensureFfmpeg(); dir = mkdtempSync(join(tmpdir(), 'ove-verify-')); }, 60_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('verifyVideo', () => {
  it('finds nothing wrong with a video of the size and length it was set to, with sound', async () => {
    expect(await verifyVideo(make('good', 'testsrc=size=320x240:rate=15', 'sine=frequency=440'), want)).toEqual([]);
  }, 60_000);

  it('reports the wrong size and length', async () => {
    expect(codes(await verifyVideo(make('size', 'testsrc=size=320x240:rate=15', 'sine=frequency=440'), { ...want, width: 640, height: 480, seconds: 5 }))).toEqual(expect.arrayContaining(['video-size', 'video-length']));
    expect(await verifyVideo(make('half', 'testsrc=size=160x120:rate=15', 'sine=frequency=440'), { ...want, scale: 0.5 })).toEqual([]);   // a draft is half size
  }, 60_000);

  it('reports sound that is missing, silent or not as loud as it was set to', async () => {
    expect(codes(await verifyVideo(make('mute', 'testsrc=size=320x240:rate=15', undefined), want))).toContain('video-no-sound');
    expect(codes(await verifyVideo(make('silent', 'testsrc=size=320x240:rate=15', 'anullsrc=r=44100:cl=mono'), want))).toContain('video-silent');
    expect(codes(await verifyVideo(make('quiet', 'testsrc=size=320x240:rate=15', 'sine=frequency=440'), { ...want, loudness: -5 }))).toContain('video-loudness');
    expect(codes(await verifyVideo(make('nosound', 'testsrc=size=320x240:rate=15', undefined), { ...want, audio: false }))).toEqual([]);
  }, 120_000);

  it('does not call a dark design with a little text on it a black frame', async () => {
    const file = join(dir, 'dark.mp4');
    const run = spawnSync(ffmpegPath(), ['-y', '-f', 'lavfi', '-i', 'color=c=0x070a08:size=320x240:rate=15:duration=3,drawbox=x=40:y=40:w=120:h=30:color=0x39ff6a:t=fill,drawbox=x=40:y=120:w=200:h=30:color=0xd9ffe0:t=fill', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-pix_fmt', 'yuv420p', '-shortest', file], { stdio: 'ignore' });
    expect(run.status).toBe(0);
    expect(codes(await verifyVideo(file, want))).not.toContain('video-black');
  }, 60_000);

  it('reports black and frozen stretches', async () => {
    expect(codes(await verifyVideo(make('black', 'color=c=black:size=320x240:rate=15', 'sine=frequency=440'), want))).toContain('video-black');
    expect(codes(await verifyVideo(make('frozen', 'color=c=white:size=320x240:rate=15', 'sine=frequency=440', 4), { ...want, seconds: 4 }))).toContain('video-frozen');
  }, 120_000);
});
