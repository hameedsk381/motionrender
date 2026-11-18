import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Composition } from '@ove/schema';
import type { Renderer } from '@ove/renderer';

const primitives = new Set(['text', 'rect', 'circle', 'path', 'group', 'line', 'ellipse']);
/** Primitive-only cache. Media, executable scenes, transitions and motion blur bypass reuse.
 * Callers must change namespace when renderer, font installation or graphics dependencies change. */
export function cachedSceneFrames(renderer: Pick<Renderer, 'renderFrame' | 'concurrency'>, composition: Composition, directory: string, namespace: string) {
  const { scenes, name, id, ...globals } = composition;
  const safeLayers = (layers: any[]): boolean => layers.every(layer => primitives.has(layer.type) && (!layer.children || safeLayers(layer.children)));
  const safe = !composition.motionBlur && !scenes.some(scene => scene.transitionIn || scene.transitionOut) && !composition.assets.length;
  const keys = new Map(scenes.filter(scene => safe && safeLayers(scene.layers)).map(scene => [scene.id, createHash('sha256').update(JSON.stringify({ namespace, globals, scene })).digest('hex')]));
  let hits = 0, misses = 0;
  return {
    concurrency: renderer.concurrency,
    stats: () => ({ hits, misses }),
    async renderFrame(frame: number) {
      const active = scenes.filter(scene => frame >= scene.startFrame && frame < scene.startFrame + scene.durationFrames);
      const scene = active.length === 1 ? active[0] : undefined, key = scene ? keys.get(scene.id) : undefined;
      if (!key) { misses++; return renderer.renderFrame(frame); }
      const folder = join(directory, key), file = join(folder, `${frame}.png`);
      try { const bytes = await readFile(file); if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { hits++; return bytes; } } catch (failure) { if ((failure as NodeJS.ErrnoException).code !== 'ENOENT') throw failure; }
      misses++; const png = await renderer.renderFrame(frame);
      await mkdir(folder, { recursive: true }); const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, png); await rename(temporary, file);
      return png;
    },
  };
}
