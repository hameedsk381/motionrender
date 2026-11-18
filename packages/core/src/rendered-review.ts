import { spawn } from 'node:child_process';
import { ensureFfmpeg, ffmpegPath, ffprobePath } from '@ove/ffmpeg';
import type { ReviewIssue } from './review';

function run(command: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000) });
    let output = '';
    const collect = (data: Buffer) => { output = (output + data.toString()).slice(-2000000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output) : reject(new Error(`Rendered-video check failed (${code}): ${output.slice(-1200)}`)));
  });
}

/** Checks the encoded deliverable. This is technical evidence, never an art-direction verdict. */
export async function reviewRenderedVideo(file: string, options: { requireAudio?: boolean; expectedDurationSeconds?: number; signal?: AbortSignal } = {}) {
  await ensureFfmpeg();
  const metadata = JSON.parse(await run(ffprobePath(), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], options.signal));
  const video = metadata.streams?.find((stream: any) => stream.codec_type === 'video'), hasAudio = metadata.streams?.some((stream: any) => stream.codec_type === 'audio') ?? false;
  const durationSeconds = Number(metadata.format?.duration), issues: ReviewIssue[] = [];
  if (!video || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('The encoded file has no usable video stream or duration');
  if (options.requireAudio && !hasAudio) issues.push({ severity: 'error', code: 'missing-audio', message: 'The encoded deliverable has no audio stream' });
  if (options.expectedDurationSeconds !== undefined && Math.abs(durationSeconds - options.expectedDurationSeconds) > 0.1) issues.push({ severity: 'error', code: 'render-duration', message: `Encoded duration is ${durationSeconds.toFixed(2)} s; expected ${options.expectedDurationSeconds.toFixed(2)} s` });
  const log = await run(ffmpegPath(), ['-hide_banner', '-nostats', '-i', file, '-vf', 'blackdetect=d=0.5:pix_th=0.1,freezedetect=n=-50dB:d=3', '-an', '-f', 'null', '-'], options.signal);
  for (const match of log.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)) issues.push({ severity: 'warning', code: 'black-gap', message: `Encoded video is nearly black from ${match[1]} to ${match[2]} s; confirm this is intentional`, suggestion: { fromSeconds: Number(match[1]), toSeconds: Number(match[2]) } });
  for (const match of log.matchAll(/freeze_start:\s*([\d.]+)/g)) issues.push({ severity: 'warning', code: 'render-frozen', message: `Encoded video holds nearly unchanged pixels from ${match[1]} s for at least 3 s; confirm the hold is intentional`, suggestion: { fromSeconds: Number(match[1]) } });
  return { scope: 'encoded-technical' as const, creativeQuality: 'unassessed' as const, durationSeconds, width: Number(video.width), height: Number(video.height), hasAudio, issues };
}
