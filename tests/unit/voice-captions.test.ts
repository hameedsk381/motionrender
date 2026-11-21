import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Captions, captionLines } from '@ove/react';
import { makeVoice } from '../../packages/cli/src/voice-command';

// `mr voice` gives a code-first video a spoken line with the time of each word, and Captions follows it. The recording itself needs the network, so these use a
// recording already made (the same cache the explainer reads) and the component at chosen frames.
const shared = (globalThis as any).__oveReact as { frame: any; config: any };
const config = { id: 't', width: 640, height: 360, fps: 30, durationInFrames: 150 };
const at = (frame: number, node: ReactNode) => renderToStaticMarkup(createElement(shared.config.Provider, { value: config }, createElement(shared.frame.Provider, { value: frame }, node)));
const words = [{ text: 'Solar', start: 0.2, end: 0.6 }, { text: 'got', start: 0.6, end: 0.9 }, { text: 'cheap.', start: 0.9, end: 1.4 }, { text: 'Scale', start: 2.0, end: 2.4 }, { text: 'did', start: 2.4, end: 2.6 }, { text: 'it.', start: 2.6, end: 3.0 }];

describe('Captions', () => {
  it('breaks lines at the end of a sentence and shows the line being said', () => {
    expect(captionLines(words).map(l => l.words.map(w => w.text).join(' '))).toEqual(['Solar got cheap.', 'Scale did it.']);
    expect(at(10, createElement(Captions, { words }))).toContain('Solar');
    expect(at(10, createElement(Captions, { words }))).not.toContain('Scale');
    expect(at(66, createElement(Captions, { words }))).toContain('Scale');
  });

  it('picks out the word being said, and shows nothing between lines', () => {
    const html = at(20, createElement(Captions, { words, color: '#111111', highlight: '#e0541b' }));   // 0.67 s: "got" is being said
    expect(html).toMatch(/color:#e0541b[^>]*>\s*got/);
    expect(at(55, createElement(Captions, { words }))).toBe('');   // 1.83 s: between the two sentences
  });
});

describe('mr voice', () => {
  let dir = '';
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ove-voice-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reports the length in frames and writes the lines to paste, reusing a recording it already has', async () => {
    const text = 'Solar got cheap.', voice = 'en-US-AriaNeural', rel = 'assets/line.wav', file = join(dir, rel);
    mkdirSync(join(dir, 'assets'), { recursive: true });
    const data = Buffer.alloc(32000), header = Buffer.alloc(44);   // one second of 16 kHz mono 16-bit silence
    header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8); header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
    writeFileSync(file, Buffer.concat([header, data]));
    writeFileSync(`${file}.words.json`, JSON.stringify(words.slice(0, 3)));
    writeFileSync(`${file}.txt`, createHash('sha1').update(`edge\n\n${voice}\n${text}`).digest('hex'));
    const got = await makeVoice(dir, text, { voice, output: rel });
    expect(got).toMatchObject({ file: rel, wordsFile: `${rel}.words.json`, seconds: 1, frames: 30, words: 3, fresh: false });
    expect(got.snippet).toContain(`import words`);
    expect(got.snippet).toContain('<Audio src="assets/line.wav" />');
    expect(got.snippet).toContain('<Captions words=');
  });
});
