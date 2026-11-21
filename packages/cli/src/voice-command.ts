// `mr voice "<what is said>"`: a spoken line for a code-first video. Records it with a free Edge voice (internet, no key), saves the audio and the time each word
// is said under assets/, and prints how long it runs and the lines to put in video.tsx, so scenes can be cut to the speech and captions follow it. The same
// words, voice and rate again reuse the recording.
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { speakLine } from '@ove/ai';

const option = (argv: string[], name: string) => { const index = argv.indexOf(name); return index < 0 ? undefined : argv[index + 1]; };

export type VoiceResult = { file: string; wordsFile: string; seconds: number; frames: number; words: number; fresh: boolean; snippet: string };

export async function makeVoice(dir: string, text: string, options: { voice?: string; rate?: number; output?: string; fps?: number } = {}): Promise<VoiceResult> {
  const folder = resolve(dir), fps = options.fps ?? 30;
  const id = createHash('sha1').update(`${options.voice ?? ''}|${options.rate ?? 0}|${text}`).digest('hex').slice(0, 8);
  const rel = options.output ?? `assets/voice-${id}.wav`, file = resolve(folder, rel);
  await mkdir(dirname(file), { recursive: true });
  const spoken = await speakLine(text, options.voice, file, options.rate), frames = Math.ceil(spoken.seconds * fps), name = `words${id}`;
  const snippet = `import ${name} from './${rel}.words.json';\n\n<Sequence from={0} durationInFrames={${frames + 6}}>\n  <Audio src="${rel}" />\n  <Captions words={${name}} color={ink} highlight={accent} style={{ position: 'absolute', left: 80, top: 1400, width: 760 }} />\n</Sequence>`;
  return { file: rel, wordsFile: `${rel}.words.json`, seconds: Math.round(spoken.seconds * 100) / 100, frames, words: spoken.words.length, fresh: spoken.fresh, snippet };
}

export async function runVoice(argv: string[]): Promise<void> {
  const text = argv[1];
  if (!text || text.startsWith('--')) throw new Error('Usage: mr voice "<what is said>" [--voice en-US-AriaNeural] [--rate 0] [--output assets/line.wav] [--dir .] [--fps 30] [--json]   (free Edge voices: needs internet, no key)');
  const rate = option(argv, '--rate') === undefined ? undefined : Number(option(argv, '--rate')), fps = option(argv, '--fps') === undefined ? 30 : Number(option(argv, '--fps'));
  if (rate !== undefined && !Number.isFinite(rate)) throw new Error('--rate must be a number, such as 12 (faster) or -10 (slower)');
  if (!Number.isInteger(fps) || fps < 1) throw new Error('--fps must be a whole number');
  const result = await makeVoice(option(argv, '--dir') ?? '.', text, { voice: option(argv, '--voice'), rate, output: option(argv, '--output'), fps });
  if (argv.includes('--json')) { console.log(JSON.stringify(result, null, 2)); return; }
  console.log(`${result.fresh ? 'Recorded' : 'Reused'} ${result.file}: ${result.seconds} s = ${result.frames} frames at ${fps} fps, ${result.words} words timed\n\nIn video.tsx (import { Audio, Captions, Sequence } from 'motionrender/react'):\n${result.snippet}\n\nCut the scene to ${result.frames} frames, and lower the music bed (volume 0.25) so the voice sits on top of it.`);
}
