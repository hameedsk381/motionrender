// `mr stock "<what you want>"`: a real photo or clip for a scene of a code-first video. Finds it on Pixabay (or Pexels) with your own free key, in the shape the
// video needs, saves it under assets/ and credits it in assets/credits.json, then prints the line to put in video.tsx. The choice is remembered, so asking again
// for the same words makes no request and gives the same file.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { StockOptions } from '@ove/api';
import { creditLine, fetchStockAsset, orientationFor } from './explainer-stock';

const option = (argv: string[], name: string) => { const index = argv.indexOf(name); return index < 0 ? undefined : argv[index + 1]; };

export type StockCommandResult = { file: string; credit: string; pageUrl: string; license: string; reused: boolean; /** The entry for config.assets: a picture or clip is used by its id. */ asset: string; snippet: string };

/** Finds, downloads and credits one asset in `dir`/assets; `stock` points tests at a stand-in for the libraries. */
export async function stockAsset(dir: string, query: string, kind: 'photo' | 'video', aspect: '9:16' | '1:1' | '4:5' | '16:9', stock?: Partial<StockOptions>): Promise<StockCommandResult> {
  const folder = resolve(dir);
  const { choice, reused } = await fetchStockAsset({ dir: folder, stock }, { query, kind, orientation: orientationFor(aspect), label: 'this search' });
  const credit = creditLine(kind, choice.result.author, choice.provider), path = `assets/${choice.file}`;
  // credits.json lists everything credited in the project; each asset appears once.
  const creditsFile = join(folder, 'assets', 'credits.json');
  let list: { file: string; credit: string; author: string; authorUrl?: string; pageUrl: string; license: string; query?: string }[] = [];
  if (existsSync(creditsFile)) { try { list = JSON.parse(await readFile(creditsFile, 'utf8')); } catch { list = []; } }
  if (!list.some(item => item.file === path)) {
    list.push({ file: path, credit, author: choice.result.author, ...(choice.result.authorUrl ? { authorUrl: choice.result.authorUrl } : {}), pageUrl: choice.result.pageUrl, license: choice.result.license, query });
    await writeFile(creditsFile, JSON.stringify(list, null, 2) + '\n');
  }
  const id = `${kind}-${String(choice.result.id)}`, asset = `{ id: '${id}', type: '${kind === 'video' ? 'video' : 'image'}', src: '${path}' }`;
  const snippet = kind === 'video' ? `<Video src="${id}" muted />` : `<Img src="${id}" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />`;
  return { file: path, credit, pageUrl: choice.result.pageUrl, license: choice.result.license, reused, asset, snippet };
}

export async function runStock(argv: string[]): Promise<void> {
  const query = argv[1];
  if (!query || query.startsWith('--')) throw new Error('Usage: mr stock "<what you want>" [--kind photo|video] [--aspect 9:16|1:1|4:5|16:9] [--dir .]   (needs PIXABAY_API_KEY, a free key from https://pixabay.com/api/docs/)');
  const kind = (option(argv, '--kind') ?? 'photo') as 'photo' | 'video', aspect = (option(argv, '--aspect') ?? '9:16') as '9:16' | '1:1' | '4:5' | '16:9';
  if (kind !== 'photo' && kind !== 'video') throw new Error('--kind must be photo or video');
  if (!['9:16', '1:1', '4:5', '16:9'].includes(aspect)) throw new Error('--aspect must be 9:16, 1:1, 4:5 or 16:9');
  const result = await stockAsset(option(argv, '--dir') ?? '.', query, kind, aspect);
  if (argv.includes('--json')) { console.log(JSON.stringify(result, null, 2)); return; }
  console.log(`${result.reused ? 'Reused' : 'Saved'} ${result.file}\n  ${result.credit} (${result.license})\n  ${result.pageUrl}\n\nDeclare it in config (a picture or clip is used by its id):\n  assets: [${result.asset}]\nThen in video.tsx:\n  ${result.snippet}\n\nShow the credit on screen or in the description; every credit is listed in assets/credits.json.`);
}
