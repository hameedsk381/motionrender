import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { runAi } from '../../packages/cli/src/ai';
import { synthesizeEdgeSpeech } from '../../packages/ai/src/edge-tts';

vi.mock('../../packages/ai/src/edge-tts', async importOriginal => ({
  ...await importOriginal<typeof import('../../packages/ai/src/edge-tts')>(),
  synthesizeEdgeSpeech: vi.fn(),
}));

afterEach(() => vi.unstubAllEnvs());

it('speaks a written script and writes Edge word timings without a text provider', async () => {
  vi.stubEnv('OVE_AI_PROVIDER', 'mock');
  const dir = await mkdtemp(join(tmpdir(), 'mr-keyless-narrate-'));
  const words = [{ text: 'Hello', start: 0, end: 0.4 }, { text: 'world', start: 0.45, end: 0.85 }];
  vi.mocked(synthesizeEdgeSpeech).mockResolvedValue({
    data: Buffer.from('test speech'), extension: 'wav', transcript: { text: 'Hello world', words, cues: [] },
  });
  try {
    const script = join(dir, 'script.txt');
    await writeFile(script, 'Hello world\n');
    const code = await runAi(['ai', 'narrate', script, '--out', dir, '--voice', 'en-IN-NeerjaNeural']);
    expect(code).toBe(0);
    expect(synthesizeEdgeSpeech).toHaveBeenCalledWith('Hello world', expect.objectContaining({ voice: 'en-IN-NeerjaNeural' }));
    expect(await readFile(join(dir, 'narration.wav'), 'utf8')).toBe('test speech');
    expect(JSON.parse(await readFile(join(dir, 'narration.captions.json'), 'utf8'))).toEqual({ words });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
