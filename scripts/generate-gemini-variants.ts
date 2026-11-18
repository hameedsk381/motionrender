import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createProvider, directConstrainedVideo } from '@ove/ai';
import { compileVideoPlan, formatVideoMarkdown, parseComposition, renderMedia, reviewComposition } from '@ove/core';

try { process.loadEnvFile('.env'); } catch { /* optional env file */ }
const connection = createProvider({ provider: 'freellmapi', model: 'gemini-3.1-flash-lite' });
if (!connection.apiKey) throw new Error('FreeLLMAPI credential is missing');
// Keep the requested Gemini route explicit; do not fall back to another model on errors.
const provider = createProvider({ provider: 'custom', model: 'gemini-3.1-flash-lite', apiKey: connection.apiKey, baseUrl: connection.baseUrl });
const facts = 'FOSS Andhra is an open-source community in Andhra Pradesh for students, developers and educators. It promotes open knowledge, data privacy and public welfare. Activities include campus clubs, workshops and open-source projects. Membership programme: FOSStar. Website: fossap.in. Use only these facts; no numbers or invented benefits.';
const variants = [
  { id: 'community', name: 'An open future, together', focus: 'A warm invitation to join people building open technology. Emphasize belonging and collaboration. Close with Join FOSStar at fossap.in.', palette: { bg: '#f8f5ef', surface: '#e8edf1', text: '#152638', muted: '#455970', accent: '#005ca8', accent2: '#dcebc0' } },
  { id: 'campus', name: 'Your first contribution', focus: 'A student-oriented campus promo. Emphasize joining a campus club, learning at workshops, and contributing to open projects. Energetic, direct copy. Close with fossap.in.', palette: { bg: '#081c36', surface: '#163658', text: '#f3f7fc', muted: '#b9cee8', accent: '#48c8fa', accent2: '#e4efcb' } },
  { id: 'mission', name: 'Knowledge belongs to everyone', focus: 'A mission-led community promo. Emphasize open knowledge, data privacy and public welfare through community contribution. Confident concise language. Close with Join FOSStar at fossap.in.', palette: { bg: '#e4efcb', surface: '#f5f8e9', text: '#182c25', muted: '#435a4b', accent: '#005ca8', accent2: '#b7d4b2' } },
];
const root = resolve('artifacts/foss-gemini-variants'); await mkdir(root, { recursive: true });
const results: any[] = [];
for (const variant of variants) {
  const dir = join(root, variant.id); await mkdir(dir, { recursive: true });
  const started = Date.now(), record: any = { id: variant.id, model: provider.model, status: 'failed' }; results.push(record);
  try {
    console.log(`Generating ${variant.id}…`);
    const result = process.argv.includes('--rerender')
      ? { plan: JSON.parse(await readFile(join(dir, 'video.plan.json'), 'utf8')), attempts: 0 }
      : await directConstrainedVideo(provider, `${facts}\nCreative angle: ${variant.focus}`, { durationSeconds: 15, width: 1920, height: 1080, maxAttempts: 3, signal: AbortSignal.timeout(120000) });
    const plan = { ...result.plan, id: `foss-${variant.id}`, name: variant.name, style: { palette: variant.palette, fonts: { display: 'Inter', body: 'Inter' } }, audio: { music: 'sfx:bed-pulse', volume: 0.2, duck: true }, export: { loudness: -16, format: 'mp4' as const } };
    await writeFile(join(dir, 'video.plan.json'), JSON.stringify(plan, null, 2));
    await writeFile(join(dir, 'video.md'), formatVideoMarkdown(plan));
    const compiled = compileVideoPlan(plan);
    // Presentation preset: keep captions fully readable through the entire workflow hold.
    for (const scene of compiled.composition.scenes) for (const layer of scene.layers as any[]) {
      if (layer.type === 'text' && layer.id.includes('-node-copy-')) { layer.maxWidth = layer.width * 0.85; layer.fontSize = 27; layer.minFontSize = 24; layer.maxLines = 2; }
      if (layer.id.endsWith('-caption')) layer.animations = layer.animations.filter((animation: any) => animation.property !== 'opacity');
      if (layer.type === 'text' && /node-copy-1$/.test(layer.id)) layer.color = variant.id === 'campus' ? '#081c36' : '#ffffff';
    }
    const composition = parseComposition(compiled.composition);
    await writeFile(join(dir, 'composition.json'), JSON.stringify(composition, null, 2));
    const review = await reviewComposition(composition, { baseDir: dir });
    await writeFile(join(dir, 'review.png'), review.sheet);
    record.attempts = result.attempts; record.issues = review.issues;
    if (review.issues.some(issue => issue.severity === 'error')) { record.status = 'review-failed'; }
    else { await renderMedia(composition, { output: join(dir, 'promo.mp4'), baseDir: dir, preset: 'veryfast' }); record.status = 'rendered'; }
  } catch (error) { record.error = (error as Error).message.replaceAll(connection.apiKey, '[redacted]'); }
  record.seconds = (Date.now() - started) / 1000;
  console.log(`${variant.id}: ${record.status} (${record.seconds.toFixed(1)}s)`);
  await writeFile(join(root, 'report.json'), JSON.stringify(results, null, 2));
}
