// How a render's speed changes with the number of browser pages: `npx tsx scripts/profile-throughput.mts composition.json from frames scale 1 2 4 ...`
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRenderer, loadComposition, renderFrames } from '../packages/core/src/index';

const [file, fromArg, countArg, scaleArg, ...levels] = process.argv.slice(2);
if (!file) throw new Error('Usage: npx tsx scripts/profile-throughput.mts composition.json from frames scale concurrency...');
const composition = loadComposition(JSON.parse(readFileSync(resolve(file), 'utf8')));
const from = Number(fromArg ?? 0), count = Number(countArg ?? 24), scale = Number(scaleArg ?? 0.5);
for (const level of (levels.length ? levels : ['1', '2', '4']).map(Number)) {
  const renderer = await createRenderer(composition, { baseDir: dirname(resolve(file)), allowCode: true, scale, concurrency: level });
  try {
    await renderer.renderFrame(from);   // start-up is not part of the measurement
    const started = performance.now(); let n = 0;
    for await (const _ of renderFrames(renderer, from + 1, from + count)) n++;
    const seconds = (performance.now() - started) / 1000;
    console.log(`concurrency ${level}: ${n} frames in ${seconds.toFixed(1)} s = ${(seconds / n * 1000).toFixed(0)} ms a frame`);
  } finally { await renderer.close(); }
}
