import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { explainerSchema, type Explainer } from '@ove/schema';
import { creditLine, fetchExplainerStock, needsStock, orientationFor } from '../../packages/cli/src/explainer-stock';

// A media scene can name the footage it wants (`stock`): the build finds it on Pixabay or Pexels with the person's own key, in the shape the video needs,
// downloads it, and credits it. These run against a stand-in for both libraries' APIs: no network, no real key.
const asked: string[] = [];
const json = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', ...headers } });
const standIn = (async (input: string | URL | Request) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  asked.push(url.toString());
  if (url.hostname === 'api.pexels.com') {
    return json({ photos: [
      { id: 11, width: 1800, height: 1200, photographer: 'Wide Wendy', url: 'https://www.pexels.com/photo/11/', src: { large2x: 'https://images.pexels.com/photos/11/wide.jpeg', medium: 'https://images.pexels.com/photos/11/m.jpeg' } },
      { id: 12, width: 1200, height: 1800, photographer: 'Jane Doe', photographer_url: 'https://www.pexels.com/@jane', url: 'https://www.pexels.com/photo/12/', src: { large2x: 'https://images.pexels.com/photos/12/tall.jpeg', medium: 'https://images.pexels.com/photos/12/m.jpeg' } },
    ], next_page: 'x', total_results: 2 }, { 'x-ratelimit-remaining': '41' });
  }
  if (url.hostname === 'pixabay.com' && url.pathname === '/api/') {
    return json({ totalHits: 2, hits: [
      { id: 21, imageWidth: 1900, imageHeight: 1200, user: 'wide_bob', pageURL: 'https://pixabay.com/photos/wide-21/', largeImageURL: 'https://pixabay.com/get/wide.jpg', webformatURL: 'https://pixabay.com/get/w.jpg' },
      { id: 22, imageWidth: 1200, imageHeight: 1900, user: 'tall_bob', pageURL: 'https://pixabay.com/photos/tall-22/', largeImageURL: 'https://pixabay.com/get/tall.jpg', webformatURL: 'https://pixabay.com/get/t.jpg' },
    ] });
  }
  if (url.hostname === 'pixabay.com' && url.pathname === '/api/videos/') {
    return json({ totalHits: 3, hits: [
      { id: 31, duration: 12, user: 'landscape_lou', pageURL: 'https://pixabay.com/videos/l-31/', videos: { large: { url: 'https://cdn.pixabay.com/video/l.mp4', width: 1920, height: 1080, thumbnail: 'https://cdn.pixabay.com/video/l.jpg' } } },
      { id: 32, duration: 3, user: 'short_sam', pageURL: 'https://pixabay.com/videos/s-32/', videos: { large: { url: 'https://cdn.pixabay.com/video/s.mp4', width: 1080, height: 1920, thumbnail: 'https://cdn.pixabay.com/video/s.jpg' } } },
      { id: 33, duration: 9, user: 'tall_tess', pageURL: 'https://pixabay.com/videos/t-33/', videos: { large: { url: 'https://cdn.pixabay.com/video/t.mp4', width: 1080, height: 1920, thumbnail: 'https://cdn.pixabay.com/video/t.jpg' } } },
    ] });
  }
  return new Response(Buffer.from(`file from ${url.hostname}${url.pathname}`));   // a footage file
}) as unknown as typeof fetch;
const stock = { fetch: standIn };

const script = (scene: Record<string, unknown>, aspect = '9:16') => explainerSchema.parse({ version: '1.0', topic: 'T', aspect, scenes: [{ kind: 'title', lines: ['A', 'B'] }, { kind: 'media', ...scene }] });
const media = (spec: Explainer) => spec.scenes[1] as Extract<Explainer['scenes'][number], { kind: 'media' }>;
let dir = '';
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'mr-stock-')); asked.length = 0; vi.stubEnv('PEXELS_API_KEY', ''); vi.stubEnv('PIXABAY_API_KEY', ''); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });

describe('a media scene that names its footage', () => {
  it('is one of src, prompt or stock, never none or two', () => {
    const parse = (scene: Record<string, unknown>) => explainerSchema.safeParse({ version: '1.0', topic: 'T', scenes: [{ kind: 'media', ...scene }] });
    expect(parse({ stock: 'ocean waves' }).success).toBe(true);
    expect(parse({}).success).toBe(false);
    expect(parse({ stock: 'ocean', src: 'assets/a.jpg' }).success).toBe(false);
    expect(parse({ stock: 'ocean', prompt: 'a wave' }).success).toBe(false);
    expect(JSON.stringify(parse({ stock: 'a', prompt: 'b' }).error!.issues)).toMatch(/exactly one of/);
  });

  it('asks for portrait footage for a vertical video, landscape for a wide one', () => {
    expect([orientationFor('9:16'), orientationFor('4:5'), orientationFor('1:1'), orientationFor('16:9')]).toEqual(['portrait', 'portrait', 'square', 'landscape']);
    expect(needsStock(script({ stock: 'x' }))).toBe(true);
    expect(needsStock(script({ src: 'assets/a.jpg' }))).toBe(false);
  });

  it('uses Pexels when its key is set: portrait asked for, the tall photo chosen, credited, and the requests left reported', async () => {
    const spec = script({ stock: 'city at night', title: 'Night' });
    const got = await fetchExplainerStock(spec, { dir, pexelsKey: 'px', pixabayKey: 'pb', stock });
    expect(asked[0]).toContain('api.pexels.com/v1/search');
    expect(new URL(asked[0]!).searchParams.get('orientation')).toBe('portrait');
    expect(new URL(asked[0]!).searchParams.get('query')).toBe('city at night');
    expect(media(got.spec)).toMatchObject({ src: 'assets/pexels-12.jpeg', credit: 'Photo: Jane Doe on Pexels' });
    expect(media(got.spec).stock).toBeUndefined();
    expect(readFileSync(join(dir, 'assets', 'pexels-12.jpeg'), 'utf8')).toContain('images.pexels.com');
    expect(got).toMatchObject({ found: 1, reused: 0, limitLeft: 41 });
    expect(media(spec).stock).toBe('city at night');   // the script itself is not changed
  });

  it('uses Pixabay when it is the only key: a vertical photo, its own credit and licence', async () => {
    const got = await fetchExplainerStock(script({ stock: 'harbour' }), { dir, pixabayKey: 'pb', stock });
    const url = new URL(asked[0]!);
    expect(url.hostname).toBe('pixabay.com');
    expect(url.searchParams.get('orientation')).toBe('vertical');
    expect(url.searchParams.get('key')).toBe('pb');
    expect(media(got.spec)).toMatchObject({ src: 'assets/pixabay-22.jpg', credit: 'Photo: tall_bob on Pixabay' });
    const credits = JSON.parse(readFileSync(join(dir, 'assets', 'credits.json'), 'utf8'));
    expect(credits).toEqual([expect.objectContaining({ scene: 2, author: 'tall_bob', license: 'Pixabay Content License', pageUrl: 'https://pixabay.com/photos/tall-22/' })]);
    expect(got.limitLeft).toBeUndefined();
  });

  it('asks Pixabay for horizontal photos for a wide video', async () => {
    await fetchExplainerStock(script({ stock: 'harbour' }, '16:9'), { dir, pixabayKey: 'pb', stock });
    expect(new URL(asked[0]!).searchParams.get('orientation')).toBe('horizontal');
  });

  it('chooses a vertical video of a usable length from a Pixabay page, since its video search has no shape to ask for', async () => {
    const got = await fetchExplainerStock(script({ stock: 'waves', stockKind: 'video' }), { dir, pixabayKey: 'pb', stock });
    const url = new URL(asked[0]!);
    expect(url.pathname).toBe('/api/videos/');
    expect(url.searchParams.has('orientation')).toBe(false);
    expect(url.searchParams.get('per_page')).toBe('50');
    expect(media(got.spec)).toMatchObject({ src: 'assets/pixabay-33.mp4', credit: 'Video: tall_tess on Pixabay' });   // 33: vertical and 9 s; 32 is vertical but 3 s; 31 is wide
  });

  it('makes no request the second time, and keeps the same footage', async () => {
    const spec = script({ stock: 'city at night' });
    const first = await fetchExplainerStock(spec, { dir, pexelsKey: 'px', stock });
    const requests = asked.length;
    const second = await fetchExplainerStock(spec, { dir, pexelsKey: 'px', stock });
    expect(asked.length).toBe(requests);
    expect(second).toMatchObject({ found: 0, reused: 1 });
    expect(media(second.spec).src).toBe(media(first.spec).src);
    // Even without a key now: the choice is already made.
    expect(media((await fetchExplainerStock(spec, { dir, stock })).spec).src).toBe(media(first.spec).src);
  });

  it('keeps a credit the script wrote, and leaves scenes that name no footage alone', async () => {
    const got = await fetchExplainerStock(script({ stock: 'city', credit: 'Video: my own words' }), { dir, pexelsKey: 'px', stock });
    expect(media(got.spec).credit).toBe('Video: my own words');
    expect(got.spec.scenes[0]).toEqual(script({ stock: 'x' }).scenes[0]);
    const plain = script({ src: 'assets/mine.jpg' });
    expect(await fetchExplainerStock(plain, { dir, stock })).toMatchObject({ spec: plain, found: 0, reused: 0 });
  });

  it('says how to get a key when there is none, and does not ask anyone anything', async () => {
    await expect(fetchExplainerStock(script({ stock: 'city' }), { dir, stock })).rejects.toThrow(/PIXABAY_API_KEY[\s\S]*PEXELS_API_KEY[\s\S]*not giving out new keys/);
    expect(asked).toEqual([]);
    expect(existsSync(join(dir, 'assets', 'credits.json'))).toBe(false);
  });

  it('refuses a download from anywhere but the libraries themselves', async () => {
    const evil = (async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      if (url.hostname === 'api.pexels.com') return json({ photos: [{ id: 1, width: 10, height: 20, photographer: 'X', url: 'https://www.pexels.com/photo/1/', src: { large2x: 'https://evil.example.com/x.jpg' } }] });
      return new Response('nope');
    }) as unknown as typeof fetch;
    // A query no other test used: searches are cached for a while, so a repeated one would never reach this stand-in.
    await expect(fetchExplainerStock(script({ stock: 'cargo ship' }), { dir, pexelsKey: 'px', stock: { fetch: evil } })).rejects.toThrow(/only come from Pexels or Pixabay/);
  });

  it('writes a credit that fits a scene, with a long name cut short', () => {
    expect(creditLine('photo', 'Jane Doe')).toBe('Photo: Jane Doe on Pexels');
    expect(creditLine('video', 'Sam', 'pixabay')).toBe('Video: Sam on Pixabay');
    const long = creditLine('photo', 'N'.repeat(200));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith('… on Pexels')).toBe(true);
  });
});
