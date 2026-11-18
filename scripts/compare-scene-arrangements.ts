import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compileVideoPlan, comparePlanVariety, compareRenderedVariety, renderMedia, reviewComposition, videoPlanSchema } from '@ove/core';

const root = resolve('artifacts/composition-variety'); await mkdir(root, { recursive: true });
const variants = [
  { id: 'editorial', layouts: ['editorial', 'horizontal', 'corner'], choreography: 'cascade', bg: '#f8f5ef', ink: '#152638', accent: '#005ca8' },
  { id: 'poster', layouts: ['poster', 'vertical', 'banner'], choreography: 'trace', bg: '#f8f5ef', ink: '#152638', accent: '#005ca8' },
  { id: 'spatial', layouts: ['split', 'radial', 'centered'], choreography: 'cascade', bg: '#f8f5ef', ink: '#152638', accent: '#005ca8' },
  { id: 'palette-control', layouts: ['editorial', 'horizontal', 'corner'], choreography: 'cascade', bg: '#081c36', ink: '#f8f5ef', accent: '#48c8fa' },
];
const plans = [], compositions = [], reports: any[] = [];
for (const variant of variants) {
  console.log(`${process.argv.includes('--compare-only') ? 'Loading' : 'Rendering'} ${variant.id}…`);
  const dir = join(root, variant.id); await mkdir(dir, { recursive: true });
  if (process.argv.includes('--compare-only')) {
    const plan = videoPlanSchema.parse(JSON.parse(await readFile(join(dir, 'video.plan.json'), 'utf8')));
    plans.push(plan); compositions.push(compileVideoPlan(plan).composition); continue;
  }
  const plan = videoPlanSchema.parse({ id: variant.id, name: variant.id, brief: { prompt: 'FOSS Andhra community promo; controlled visual comparison' }, format: { width: 1280, height: 720, fps: 30 }, style: { palette: { bg: variant.bg, surface: variant.bg, text: variant.ink, muted: variant.ink, accent: variant.accent } }, beats: [
    { id: 'idea', intent: 'Invite participation', durationSeconds: 3, visual: { scene: 'kinetic-hook', input: { type: 'kinetic-hook', headline: 'Build an open future together', layout: variant.layouts[0], choreography: variant.choreography } } },
    { id: 'participation', intent: 'Show participation', durationSeconds: 3, visual: { scene: 'workflow', input: { type: 'workflow', headline: 'A community built on contribution', steps: ['Campus clubs', 'Shared learning', 'Open projects'], layout: variant.layouts[1], choreography: variant.choreography } } },
    { id: 'invitation', intent: 'Invite membership', durationSeconds: 3, visual: { scene: 'decisive-cta', input: { type: 'decisive-cta', headline: 'Join FOSStar at fossap.in', layout: variant.layouts[2], choreography: variant.choreography } } },
  ] });
  const { composition } = compileVideoPlan(plan); plans.push(plan); compositions.push(composition);
  await writeFile(join(dir, 'video.plan.json'), JSON.stringify(plan, null, 2));
  await writeFile(join(dir, 'composition.json'), JSON.stringify(composition, null, 2));
  const review = await reviewComposition(composition, { baseDir: dir, audio: false });
  await writeFile(join(dir, 'review.png'), review.sheet);
  reports.push({ id: variant.id, issues: review.issues });
  if (review.issues.some(issue => issue.severity === 'error')) throw new Error(`${variant.id} failed technical review: ${JSON.stringify(review.issues)}`);
  await renderMedia(composition, { baseDir: dir, output: join(dir, 'video.mp4'), preset: 'veryfast' });
}
const comparisons: any[] = [];
for (const index of [0, 1, 2, 3]) {
  console.log(`Comparing editorial with ${variants[index]!.id}…`);
  comparisons.push({ left: 'editorial', right: variants[index]!.id, structure: comparePlanVariety(plans[0], plans[index]), rendered: await compareRenderedVariety(compositions[0]!, compositions[index]!, { baseDirA: join(root, 'editorial'), baseDirB: join(root, variants[index]!.id) }) });
}
await writeFile(join(root, 'report.json'), JSON.stringify({ purpose: 'Controlled composition/choreography comparison, identical copy; not a creative-quality score', reports, comparisons }, null, 2));
console.log(`Report: ${join(root, 'report.json')}`);
