import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dir = new URL('./', import.meta.url);
const file = name => fileURLToPath(new URL(name, dir));
const fps = 60;
const seconds = 14;
const samples = 4;
const settings = process.argv.includes('--settings');
const prefix = settings ? 'settings-' : '';

function ffmpeg(args) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = once(child, 'exit').then(([code]) => {
    if (code !== 0) throw new Error(`FFmpeg exited with code ${code}`);
  });
  child.stdin.on('error', () => {});
  done.catch(() => {});
  return { child, done };
}

async function score() {
  const rate = 48000;
  const pcm = new Float64Array(seconds * rate);
  const notes = [110, 110, 130.813, 146.832, 110, 164.814, 146.832];
  const tau = Math.PI * 2;
  for (let beat = 0; beat < 28; beat++) {
    for (let j = 0; j < rate / 2; j++) {
      const t = j / rate;
      const envelope = Math.min(1, t * 500) * Math.exp(-t * 14);
      pcm[beat * rate / 2 + j] = envelope * (
        .36 * Math.sin(tau * (46 * t + 1.8 * (1 - Math.exp(-t * 41)))) +
        .21 * Math.sin(tau * notes[Math.floor(beat / 4)] * t) +
        (beat % 2 ? .07 : .025) * Math.sin(tau * 2791 * t) * Math.exp(-t * 96));
    }
  }
  const click = Array.from({ length: 1700 }, (_, i) =>
    Math.sin(tau * 1470 * i / rate) * Math.min(1, i / 15) * Math.exp(-i / 260));
  const peak = click.reduce((best, value, i) => Math.abs(value) > Math.abs(click[best]) ? i : best, 0);
  for (const beat of [1, 3, 5, 7, 8, 10, 11, 13, 14, 16, 20, 21, 22, 23, 24, 25]) {
    const start = beat * rate / 2 - peak;
    click.forEach((value, i) => { pcm[start + i] += .16 * value; });
  }
  const wav = Buffer.alloc(44 + pcm.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(pcm.length * 2, 40);
  pcm.forEach((value, i) => wav.writeInt16LE(Math.round(value * 31000), 44 + 2 * i));
  await writeFile(file('score.wav'), wav);
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.OVE_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.OVE_CHROMIUM_EXECUTABLE }
    : { channel: 'chrome' }),
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1440 } });
  await page.goto(new URL(settings ? 'index.html?recipe=settings' : 'index.html', dir).href);
  await page.evaluate(() => document.fonts.ready);
  const seek = t => page.evaluate(time => window.seek(time), t);
  const opener = await page.screenshot();
  for (const time of [4.5, 4.8, 4.6]) {
    await seek(time);
    const actual = Number(await page.locator('#playhead').getAttribute('data-x'));
    if (actual !== (settings ? 52 : 146)) throw new Error(`Playhead moved after release at ${time}`);
  }
  await seek(7.45);
  const originalIndicator = await page.locator('#indicator').elementHandle();
  await seek(8.75);
  const expected = settings ? 105 : -105;
  if (Number(await originalIndicator.getAttribute('x')) !== expected) {
    throw new Error('Persistent indicator did not reach the selected tab');
  }
  await seek(14);
  if (!opener.equals(await page.screenshot())) throw new Error('Loop boundary differs');
  await seek(14 - 1 / fps);
  if (!opener.equals(await page.screenshot())) throw new Error('Last frame differs');

  await mkdir(file(`${prefix}beats`), { recursive: true });
  for (let beat = 0; beat < 28; beat++) {
    await seek(beat / 2 + .32);
    await page.screenshot({ path: file(`${prefix}beats/${String(beat).padStart(2, '0')}.png`) });
  }
  const sheet = ffmpeg(['-i', file(`${prefix}beats/%2502d.png`), '-vf',
    'scale=240:240,tile=7x4:padding=4:margin=4:color=0xc9c6bf',
    '-frames:v', '1', '-update', '1', file(`${prefix}review.png`)]);
  sheet.child.stdin.end();
  await sheet.done;

  if (!process.argv.includes('--review')) {
    await score();
    const encode = ffmpeg(['-f', 'image2pipe', '-framerate', String(fps * samples),
      '-vcodec', 'mjpeg', '-i', 'pipe:0', '-i', file('score.wav'),
      '-vf', "tmix=frames=4,select='eq(mod(n,4),3)',setpts=N/60/TB",
      '-r', String(fps), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
      file(`${prefix}ui-morph.mp4`)]);
    try {
      for (let frame = 0; frame < fps * seconds; frame++) {
        for (let sample = 0; sample < samples; sample++) {
          await seek((frame + sample / samples) / fps);
          const still = await page.screenshot({ type: 'jpeg', quality: 96 });
          if (!encode.child.stdin.write(still)) await once(encode.child.stdin, 'drain');
        }
        if ((frame + 1) % fps === 0) console.log(`Captured ${(frame + 1) / fps}/14 seconds`);
      }
    } finally {
      encode.child.stdin.end();
      await encode.done;
    }
  }
} finally {
  await browser.close();
}
