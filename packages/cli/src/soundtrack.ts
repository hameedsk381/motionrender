import { randomUUID } from 'node:crypto';
import { rename, rm } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureFfmpeg, ffmpegPath } from '@ove/core';

export async function replaceSoundtrack(video: string, audio: string, output: string) {
  const destination = resolve(output);
  if ([video, audio].some(input => resolve(input).toLowerCase() === destination.toLowerCase())) throw new Error('Choose a separate output file');
  if (extname(destination).toLowerCase() !== '.mp4') throw new Error('The soundtrack output must be an MP4');
  await ensureFfmpeg();
  const temporary = join(dirname(destination), randomUUID() + '.mp4');
  try {
    await promisify(execFile)(ffmpegPath(), ['-nostdin', '-v', 'error', '-i', resolve(video), '-i', resolve(audio),
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-af', 'apad', '-shortest', temporary]);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
