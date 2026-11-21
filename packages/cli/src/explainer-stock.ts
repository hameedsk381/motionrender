// Stock footage for explainer scenes: a media scene that says what it wants (`stock: "ocean waves"`) gets a real photo or video at build time, from Pexels or
// Pixabay. The search runs with the person's own free key (PEXELS_API_KEY or PIXABAY_API_KEY; Pexels is used when both are set), asks for the shape the video
// needs (portrait for a vertical one), downloads the file into assets/ and sets `src` and a credit line, so a script can name footage and a finished video can
// credit it. The choice is kept in a small file next to the footage, so building again makes no request and picks the same file: that keeps one script's video
// the same from one build to the next and keeps the requests few (both libraries limit them, and Pixabay asks that automated queries be kept to a minimum).
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { Explainer } from '@ove/schema';
import { defaultStockOptions, downloadStock, searchStock, STOCK_LABELS, STOCK_LICENSES, type StockOptions, type StockOrientation, type StockResult } from '@ove/api';

type Media = Extract<Explainer['scenes'][number], { kind: 'media' }>;
type Provider = 'pexels' | 'pixabay';
/** What was chosen for one scene: kept as assets/stock-<hash>.json beside the file. */
type Choice = { provider: Provider; query: string; kind: 'photo' | 'video'; orientation: StockOrientation; file: string; result: Omit<StockResult, 'file'> & { license: string } };

/** Whether any media scene asks for stock footage and has none yet. */
export const needsStock = (spec: Explainer): boolean => spec.scenes.some(scene => scene.kind === 'media' && scene.stock !== undefined && scene.src === undefined);

/** The shape of footage a video wants: portrait for a vertical or 4:5 video, square for 1:1, landscape for 16:9. */
export const orientationFor = (aspect: Explainer['aspect']): StockOrientation => (aspect === '16:9' ? 'landscape' : aspect === '1:1' ? 'square' : 'portrait');

/** "Photo: Jane Doe on Pexels", short enough for a scene's credit line (80 characters). */
export const creditLine = (kind: 'photo' | 'video', author: string, provider: Provider = 'pexels'): string => {
  const head = kind === 'video' ? 'Video: ' : 'Photo: ', tail = ` on ${STOCK_LABELS[provider]}`, room = 80 - head.length - tail.length;
  return `${head}${author.length > room ? `${author.slice(0, room - 1)}…` : author}${tail}`;
};

/** The best of a page of results: the shape asked for, and for video one long enough to hold a scene. */
export function pick(results: StockResult[], kind: 'photo' | 'video', orientation: StockOrientation): StockResult | undefined {
  const shaped = results.filter(item => (orientation === 'portrait' ? item.height >= item.width : orientation === 'landscape' ? item.width >= item.height : Math.abs(item.width - item.height) / Math.max(1, item.width, item.height) < 0.1));
  const pool = shaped.length ? shaped : results;
  return (kind === 'video' ? pool.find(item => (item.duration ?? 0) >= 5) : undefined) ?? pool[0];
}

export type StockStepOptions = {
  /** The video's folder: footage goes to <dir>/assets. */ dir: string;
  /** Pexels key (default: PEXELS_API_KEY). Pexels is not giving out new keys at present, so this is for people who already have one. */ pexelsKey?: string;
  /** Pixabay key (default: PIXABAY_API_KEY): a free sign-up at https://pixabay.com/api/docs/. */ pixabayKey?: string;
  /** Where the libraries live and how to fetch from them; tests point these at a stand-in. */ stock?: Partial<StockOptions>;
  onProgress?: (message: string) => void;
};

/** Which library to ask: Pexels when its key is set, else Pixabay; no key at all is an error that says how to get one. */
function chooseProvider(options: StockStepOptions, scene: number | string, query: string): { provider: Provider; apiKey: string } {
  const pexels = (options.pexelsKey ?? process.env.PEXELS_API_KEY ?? '').trim(), pixabay = (options.pixabayKey ?? process.env.PIXABAY_API_KEY ?? '').trim();
  if (pexels) return { provider: 'pexels', apiKey: pexels };
  if (pixabay) return { provider: 'pixabay', apiKey: pixabay };
  throw new Error(`${typeof scene === 'number' ? `Scene ${scene}` : scene} asks for stock footage ("${query}"), which needs a free key: set PIXABAY_API_KEY (sign up at https://pixabay.com/api/docs/) or PEXELS_API_KEY (Pexels is not giving out new keys at the moment). Or give the scene a file (src).`);
}

/**
 * One piece of footage for a search: from the choice remembered beside the files when there is one (no request, the same file as last time), else
 * found on the library, downloaded into assets/ and remembered. The explainer's media scenes and `mr stock` both use it.
 */
export async function fetchStockAsset(options: StockStepOptions, request: { query: string; kind: 'photo' | 'video'; orientation: StockOrientation; label: string; scene?: number }): Promise<{ choice: Choice; reused: boolean; limitLeft?: number }> {
  const use: StockOptions = { ...defaultStockOptions, ...options.stock }, assets = join(options.dir, 'assets'), { query, kind, orientation } = request;
  await mkdir(assets, { recursive: true });
  // The choice is remembered per library, so adding a key for another library later does not swap footage that is already chosen.
  const sidecars = (['pexels', 'pixabay'] as const).map(provider => join(assets, `stock-${createHash('sha1').update(`${provider}|${kind}|${orientation}|${query.toLowerCase()}`).digest('hex').slice(0, 10)}.json`));
  for (const sidecar of sidecars) {
    if (!existsSync(sidecar)) continue;
    try { const saved = JSON.parse(await readFile(sidecar, 'utf8')) as Choice; if (existsSync(join(assets, saved.file))) return { choice: saved, reused: true }; } catch { /* unreadable: look again */ }
  }
  const { provider, apiKey } = chooseProvider(options, request.scene ?? 'This search', query);
  options.onProgress?.(`Looking for ${kind === 'video' ? 'footage' : 'a photo'} of "${query}" on ${STOCK_LABELS[provider]} for ${request.label}…`);
  // Pixabay's video search has no shape to ask for, so a long page is asked for and the shape is chosen here.
  const page = await searchStock(provider, apiKey, { q: query, kind, page: 1, perPage: provider === 'pixabay' && kind === 'video' ? 50 : 20, orientation }, use);
  const best = pick(page.results, kind, orientation);
  if (!best) throw new Error(`${STOCK_LABELS[provider]} has no ${kind === 'video' ? 'video' : 'photo'} for "${query}" (${request.label}). Try other words, or give it a file (src).`);
  const bytes = await downloadStock(best.file, use), file = `${provider}-${best.id}${best.ext}`;
  await writeFile(join(assets, file), bytes);
  const { file: _link, ...rest } = best;
  const choice: Choice = { provider, query, kind, orientation, file, result: { ...rest, license: STOCK_LICENSES[provider] } };
  await writeFile(sidecars[provider === 'pexels' ? 0 : 1]!, JSON.stringify(choice, null, 2) + '\n');
  return { choice, reused: false, ...(provider === 'pexels' && page.limitLeft !== undefined ? { limitLeft: page.limitLeft } : {}) };
}

/**
 * Finds and downloads the footage for every media scene that has `stock` and no `src`, and returns the script with `src` and `credit` set (the search words
 * dropped), leaving the original untouched. Also writes assets/credits.json, a list of everything credited, with the links to each page.
 */
export async function fetchExplainerStock(spec: Explainer, options: StockStepOptions): Promise<{ spec: Explainer; found: number; reused: number; limitLeft?: number }> {
  if (!needsStock(spec)) return { spec, found: 0, reused: 0 };
  const orientation = orientationFor(spec.aspect), assets = join(options.dir, 'assets');
  await mkdir(assets, { recursive: true });
  let found = 0, reused = 0, limitLeft: number | undefined;
  const scenes: Explainer['scenes'] = [], credits: { scene: number; credit: string; author: string; authorUrl?: string; pageUrl: string; license: string; file: string }[] = [];
  for (const [i, scene] of spec.scenes.entries()) {
    if (scene.kind !== 'media' || scene.stock === undefined || scene.src !== undefined) { scenes.push(scene); continue; }
    const media: Media = scene, kind = media.stockKind ?? 'photo', query = media.stock!;
    const { choice, reused: was, limitLeft: left } = await fetchStockAsset(options, { query, kind, orientation, label: `scene ${i + 1}`, scene: i + 1 });
    if (left !== undefined) limitLeft = left;
    if (was) reused++; else found++;
    const { stock: _stock, stockKind: _kind, ...rest } = media;
    const credit = media.credit ?? creditLine(kind, choice.result.author, choice.provider);
    scenes.push({ ...rest, src: `assets/${choice.file}`, credit });
    credits.push({ scene: i + 1, credit, author: choice.result.author, ...(choice.result.authorUrl ? { authorUrl: choice.result.authorUrl } : {}), pageUrl: choice.result.pageUrl, license: choice.result.license, file: `assets/${choice.file}` });
  }
  await writeFile(join(assets, 'credits.json'), JSON.stringify(credits, null, 2) + '\n');
  return { spec: { ...spec, scenes }, found, reused, ...(limitLeft !== undefined ? { limitLeft } : {}) };
}
