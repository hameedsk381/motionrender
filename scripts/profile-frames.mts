// Times single frames of a composition, one page at a time: `npx tsx scripts/profile-frames.mts composition.json [scale] [frames...]`.
// It separates the first frame (browser and scene start-up) from the steady cost per frame, which is what a render's length is made of.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRenderer, loadComposition } from '../packages/core/src/index';

const [file, scaleArg, ...frameArgs] = process.argv.slice(2);
if (!file) throw new Error('Usage: npx tsx scripts/profile-frames.mts composition.json [scale] [frames...]');
const composition = loadComposition(JSON.parse(readFileSync(resolve(file), 'utf8')));
const scale = Number(scaleArg ?? 0.5), frames = frameArgs.length ? frameArgs.map(Number) : [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const renderer = await createRenderer(composition, { baseDir: dirname(resolve(file)), allowCode: true, scale, concurrency: 1 });
try {
  const times: number[] = [];
  for (const frame of frames) {
    const started = performance.now();
    await renderer.renderFrame(frame);
    times.push(performance.now() - started);
    console.log(`frame ${frame}: ${Math.round(times[times.length - 1]!)} ms`);
  }
  const steady = times.slice(1);
  console.log(`first ${Math.round(times[0]!)} ms, then ${Math.round(steady.reduce((a, b) => a + b, 0) / Math.max(1, steady.length))} ms a frame on average (${steady.length} frames, scale ${scale})`);
} finally { await renderer.close(); }
