// A check on the finished MP4, not the plan for it: the picture and sound that were actually written. The review reads the composition and a few frames; this
// reads the file, so a video that rendered to the wrong size or length, with no sound where there should be some, or with a black or frozen stretch, says so.
import { spawn } from 'node:child_process';
import { ensureFfmpeg, ffmpegPath, ffprobePath } from '@ove/ffmpeg';

export type VideoCheck = { severity: 'error' | 'warning' | 'info'; code: string; message: string };
export type VideoExpectation = {
  width: number; height: number; /** Length in seconds. */ seconds: number;
  /** Whether the video should have sound at all (it names a voice, music or a sound effect). */ audio: boolean;
  /** The loudness the video was set to (LUFS), if any. */ loudness?: number;
  /** A draft is drawn at half size: its dimensions are checked against that. */ scale?: number;
};

const run = (bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> => new Promise((resolve, reject) => {
  const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.on('error', reject);
  child.on('close', () => resolve({ stdout, stderr }));
});

const number = (text: string, pattern: RegExp) => { const match = pattern.exec(text); return match ? Number(match[1]) : undefined; };

/** Reads the finished file and lists what is wrong with it (nothing, when it is right). */
export async function verifyVideo(file: string, expected: VideoExpectation): Promise<VideoCheck[]> {
  await ensureFfmpeg();
  const checks: VideoCheck[] = [];
  const probed = JSON.parse((await run(ffprobePath(), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file])).stdout || '{}') as { streams?: { codec_type: string; width?: number; height?: number; duration?: string }[]; format?: { duration?: string } };
  const video = probed.streams?.find(stream => stream.codec_type === 'video'), audio = probed.streams?.find(stream => stream.codec_type === 'audio');
  if (!video) return [{ severity: 'error', code: 'video-no-picture', message: 'The file has no picture stream' }];
  const scale = expected.scale ?? 1, wantWidth = Math.round(expected.width * scale), wantHeight = Math.round(expected.height * scale);
  if (Math.abs((video.width ?? 0) - wantWidth) > 2 || Math.abs((video.height ?? 0) - wantHeight) > 2) checks.push({ severity: 'error', code: 'video-size', message: `The video is ${video.width}x${video.height}, not the ${wantWidth}x${wantHeight} it was set to` });
  const length = Number(probed.format?.duration ?? video.duration ?? 0);
  if (Math.abs(length - expected.seconds) > 0.25) checks.push({ severity: 'error', code: 'video-length', message: `The video is ${length.toFixed(2)} s long, not the ${expected.seconds.toFixed(2)} s it was set to` });
  if (expected.audio && !audio) checks.push({ severity: 'error', code: 'video-no-sound', message: 'The video names sound (a voice, music or effects) but the file has no audio stream' });

  // One pass over the file for black stretches, frozen stretches and loudness.
  const { stderr } = await run(ffmpegPath(), ['-nostats', '-i', file, '-vf', 'blackdetect=d=0.6:pix_th=0.12,freezedetect=n=0.003:d=2.5', ...(audio ? ['-af', 'ebur128'] : ['-an']), '-f', 'null', '-']);
  for (const match of stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g)) {
    const start = Number(match[1]), duration = Number(match[3]);
    if (start < 0.05 && duration < 1.2) continue;   // a fade in from black is a choice
    checks.push({ severity: 'warning', code: 'video-black', message: `Black for ${duration.toFixed(1)} s from ${start.toFixed(1)} s: is that meant, or did something fail to draw?` });
  }
  // A freeze that ends is logged with its duration; one that runs to the end of the file is logged only by its start.
  const starts = [...stderr.matchAll(/freeze_start: ([\d.]+)/g)].map(match => Number(match[1])), durations = [...stderr.matchAll(/freeze_duration: ([\d.]+)/g)].map(match => Number(match[1]));
  let frozen = durations.reduce((sum, duration) => sum + duration, 0);
  if (starts.length > durations.length) frozen += Math.max(0, length - starts[starts.length - 1]!);
  if (length > 0 && frozen / length >= 0.4) checks.push({ severity: 'warning', code: 'video-frozen', message: `The picture does not change for ${frozen.toFixed(1)} s of ${length.toFixed(1)} s: add motion, or shorten the hold` });
  if (audio) {
    const summary = stderr.slice(stderr.lastIndexOf('Summary:')), integrated = number(summary, /I:\s+(-?[\d.]+) LUFS/);
    if (integrated === undefined || integrated < -50) checks.push({ severity: 'error', code: 'video-silent', message: 'The sound in the file is silent' });
    else if (expected.loudness !== undefined && Math.abs(integrated - expected.loudness) > 3) checks.push({ severity: 'warning', code: 'video-loudness', message: `The sound measures ${integrated.toFixed(1)} LUFS, not the ${expected.loudness} LUFS it was set to` });
  }
  return checks;
}
