import { createHash } from 'node:crypto';
import type { Composition } from '@ove/schema';

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

/** Conservative scene invalidation. Absolute timing and global dependencies remain in the key.
 * This describes composition changes, not a claim that rendered media exists in a cache.
 * A render cache must additionally hash file bytes and pin the renderer version/settings. */
export function sceneChangeManifest(before: Composition, after: Composition) {
  const fingerprints = (composition: Composition) => {
    const { scenes, name, id, ...globals } = composition;
    return new Map(scenes.map(scene => [scene.id, digest({ globals, scene })]));
  };
  const previous = fingerprints(before), next = fingerprints(after);
  return {
    scenes: after.scenes.map(scene => ({ id: scene.id, startFrame: scene.startFrame, durationFrames: scene.durationFrames, fingerprint: next.get(scene.id)!, status: !previous.has(scene.id) ? 'added' as const : previous.get(scene.id) === next.get(scene.id) ? 'unchanged' as const : 'changed' as const })),
    removed: before.scenes.filter(scene => !next.has(scene.id)).map(scene => scene.id),
  };
}
