import type { Composition } from '@ove/schema';
import { createRenderer } from '@ove/renderer';

type Thumbnail = { width: number; height: number; pixels: number[] };
const edges = (thumb: Thumbnail): number[] => thumb.pixels.map((value, i) => {
  const x = i % thumb.width, y = Math.floor(i / thumb.width);
  return x && y && Math.abs(value - thumb.pixels[i - 1]!) + Math.abs(value - thumb.pixels[i - thumb.width]!) > 20 ? 1 : 0;
});
const dice = (a: number[], b: number[]) => { let hits = 0, total = 0; for (let i = 0; i < a.length; i++) { hits += a[i]! * b[i]!; total += a[i]! + b[i]!; } return total ? 2 * hits / total : undefined; };

/** Sampled rendered similarity. Edge overlap reduces palette influence; neither metric rates creativity. */
export async function compareRenderedVariety(a: Composition, b: Composition, options: { baseDirA: string; baseDirB: string; allowCode?: boolean; samples?: number }) {
  if (a.width / a.height !== b.width / b.height) throw new Error('Rendered comparison requires the same aspect ratio');
  const count = options.samples ?? 7;
  if (!Number.isInteger(count) || count < 3 || count > 30) throw new Error('Use 3–30 comparison samples');
  const capture = async (composition: Composition, baseDir: string) => {
    const renderer = await createRenderer(composition, { baseDir, allowCode: options.allowCode, concurrency: 1, scale: Math.min(1, 640 / composition.width) });
    try { const samples: { frame: number; thumb: Thumbnail }[] = []; for (let i = 0; i < count; i++) { const frame = Math.round((i + .5) * (composition.durationFrames - 1) / count); const report = await renderer.inspectFrame(frame); samples.push({ frame, thumb: report.thumb }); } return samples; }
    finally { await renderer.close(); }
  };
  const left = await capture(a, options.baseDirA), right = await capture(b, options.baseDirB);
  const samples = left.map((sample, i) => {
    const other = right[i]!, ea = edges(sample.thumb), eb = edges(other.thumb);
    if (sample.thumb.pixels.length !== other.thumb.pixels.length) throw new Error('Thumbnail dimensions differ');
    const enoughEdges = ea.reduce((sum, n) => sum + n, 0) >= 10 && eb.reduce((sum, n) => sum + n, 0) >= 10;
    return { frameA: sample.frame, frameB: other.frame, pixelSimilarity: 1 - sample.thumb.pixels.reduce((sum, n, k) => sum + Math.abs(n - other.thumb.pixels[k]!), 0) / sample.thumb.pixels.length / 255, edgeSimilarity: enoughEdges ? dice(ea, eb) : undefined };
  });
  const covered = samples.filter(sample => sample.edgeSimilarity !== undefined), pixelSimilarity = samples.reduce((sum, sample) => sum + sample.pixelSimilarity, 0) / count;
  const edgeSimilarity = covered.length ? covered.reduce((sum, sample) => sum + sample.edgeSimilarity!, 0) / covered.length : undefined;
  const sufficient = covered.length >= Math.ceil(count / 2);
  return { scope: 'sampled-rendered-similarity' as const, creativeQuality: 'unassessed' as const, samples, pixelSimilarity, edgeSimilarity, coveredSamples: covered.length, verdict: !sufficient ? 'inconclusive' as const : edgeSimilarity! >= .82 ? 'likely-repeated' as const : 'different-samples' as const, thresholds: { edgeSimilarity: .82 }, limitation: 'Heuristic thresholds are uncalibrated. Sparse grayscale samples can miss brief events, timing differences and semantic repetition. Raw pixel agreement is reported but not used for classification because background fields dominate it.' };
}
