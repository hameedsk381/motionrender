import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stockAsset } from '../../packages/cli/src/stock-command';

// `mr stock` gives a code-first video a real photo, saved in assets/ and credited. These run against a stand-in for the library: no network, no real key.
let asked = 0;
const standIn = (async (input: string | URL | Request) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname === 'pixabay.com' && url.pathname === '/api/') {
    asked++;
    return new Response(JSON.stringify({ totalHits: 2, hits: [
      { id: 21, imageWidth: 1900, imageHeight: 1200, user: 'wide_bob', pageURL: 'https://pixabay.com/photos/wide-21/', largeImageURL: 'https://pixabay.com/get/wide.jpg', webformatURL: 'https://pixabay.com/get/w.jpg' },
      { id: 22, imageWidth: 1200, imageHeight: 1900, user: 'tall_bob', pageURL: 'https://pixabay.com/photos/tall-22/', largeImageURL: 'https://pixabay.com/get/tall.jpg', webformatURL: 'https://pixabay.com/get/t.jpg' },
    ] }), { headers: { 'content-type': 'application/json' } });
  }
  return new Response(Buffer.from('a photo'));
}) as unknown as typeof fetch;

let dir = '', saved: Record<string, string | undefined> = {};
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ove-stock-')); asked = 0; saved = { p: process.env.PIXABAY_API_KEY, x: process.env.PEXELS_API_KEY }; process.env.PIXABAY_API_KEY = 'test-key'; delete process.env.PEXELS_API_KEY; });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); if (saved.p === undefined) delete process.env.PIXABAY_API_KEY; else process.env.PIXABAY_API_KEY = saved.p; if (saved.x !== undefined) process.env.PEXELS_API_KEY = saved.x; });

describe('mr stock', () => {
  it('saves a photo in the shape the video needs, credits it, and says what to write', async () => {
    const got = await stockAsset(dir, 'solar panels', 'photo', '9:16', { fetch: standIn });
    expect(got).toMatchObject({ file: 'assets/pixabay-22.jpg', credit: 'Photo: tall_bob on Pixabay', reused: false });
    expect(existsSync(join(dir, got.file))).toBe(true);
    expect(got.asset).toBe("{ id: 'photo-22', type: 'image', src: 'assets/pixabay-22.jpg' }");
    expect(got.snippet).toContain('<Img src="photo-22"');
    expect(JSON.parse(readFileSync(join(dir, 'assets', 'credits.json'), 'utf8'))).toEqual([expect.objectContaining({ file: 'assets/pixabay-22.jpg', author: 'tall_bob', query: 'solar panels' })]);
  });

  it('asks the library once: the same words again reuse the file and list it once', async () => {
    await stockAsset(dir, 'wind turbines', 'photo', '9:16', { fetch: standIn });
    const again = await stockAsset(dir, 'wind turbines', 'photo', '9:16', { fetch: standIn });
    expect(again.reused).toBe(true); expect(asked).toBe(1);
    expect(JSON.parse(readFileSync(join(dir, 'assets', 'credits.json'), 'utf8'))).toHaveLength(1);
  });

  it('says how to get a key when there is none', async () => {
    delete process.env.PIXABAY_API_KEY;
    await expect(stockAsset(dir, 'x', 'photo', '9:16', { fetch: standIn })).rejects.toThrow(/PIXABAY_API_KEY/);
  });
});
