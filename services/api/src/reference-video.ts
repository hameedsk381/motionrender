import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureFfmpeg, ffmpegPath, probe } from '@ove/ffmpeg';

/** A bounded visual reference sheet. Sampling is explicit; it does not invent semantic shot descriptions. */
export async function sampleReferenceVideo(source: string, output: string) {
  await ensureFfmpeg();
  const seconds = Number(await probe(source));
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Reference duration could not be measured');
  await mkdir(output, { recursive: true });
  const interval = Math.max(seconds / 12, 0.1);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath(), ['-y', '-i', source, '-vf', `fps=1/${interval},scale=480:-2`, '-frames:v', '12', join(output, 'frame-%02d.jpg')], { windowsHide: true });
    let error = '';
    child.stderr.on('data', data => { error = (error + data).slice(-4000); });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Reference extraction timed out')); }, 60000);
    child.on('error', failure => { clearTimeout(timer); reject(failure); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(error)); });
  });
  return { seconds, interval };
}
