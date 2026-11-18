import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createProvider, directConstrainedVideo, type AiProvider } from '@ove/ai';
import { compileVideoPlan, renderMedia, reviewComposition, reviewRenderedVideo } from '@ove/core';

try { process.loadEnvFile('.env'); } catch { /* shell configuration may supply the key */ }
const providerId = process.argv.includes('--provider=freellmapi') ? 'freellmapi' : 'groq';
const connection = createProvider({ provider: providerId, model: 'auto' });
const key = connection.apiKey;
if (!key) throw new Error(`${providerId} API key is not configured`);
const response = await fetch(`${connection.baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`${providerId} model discovery returned HTTP ${response.status}`);
const available = ((await response.json()) as { data: { id: string; available?: boolean }[] }).data.filter(model => model.available !== false).map(model => model.id).sort();
if (process.argv.includes('--list')) { console.log(JSON.stringify(available, null, 2)); process.exit(0); }
const requested = process.argv.find(value => value.startsWith('--models='))?.slice(9).split(',');
const models = requested ?? ['llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'].filter(model => available.includes(model));
if (!models.length || models.some(model => !available.includes(model))) throw new Error('Select available Groq models');
const output = resolve(process.argv.find(value => value.startsWith('--out='))?.slice(6) ?? 'artifacts/groq-constrained-eval'); await mkdir(output, { recursive: true });
const brief = 'Create a brand promo for FOSS Andhra (fossap.in), an open-source community in Andhra Pradesh for students, developers and educators. It promotes open knowledge, data privacy and public welfare. Activities include campus clubs, workshops and open-source projects. End by inviting viewers to join FOSStar at fossap.in. Do not invent numbers or services. Use only this supplied source summary.';
const records: any[] = [];
for (const model of models) {
  const directory = join(output, model.replace(/[^a-z0-9-]/gi, '-')); await mkdir(directory, { recursive: true });
  const record: any = { model, status: 'failed', calls: 0, responses: [], startedAt: new Date().toISOString() }; records.push(record);
  const started = Date.now();
  try {
    // The production gateway provider falls back to auto on errors. Benchmarks must fail instead.
    const provider = createProvider({ provider: providerId === 'freellmapi' ? 'custom' : providerId, model, apiKey: key, baseUrl: connection.baseUrl });
    const measured: AiProvider = { ...provider, id: provider.id, model, baseUrl: provider.baseUrl, chat: async (messages, options) => {
      record.calls++;
      const reply = await provider.chat(messages, { ...options, model, maxRetries: 0 });
      record.responses.push(reply); return reply;
    } };
    console.log(`Testing ${model}…`);
    const result = await directConstrainedVideo(measured, brief, { durationSeconds: 20, width: 1920, height: 1080, maxAttempts: 3, signal: AbortSignal.timeout(120000) });
    record.generationSeconds = (Date.now() - started) / 1000; record.attempts = result.attempts;
    const { composition } = compileVideoPlan(result.plan);
    record.status = 'compiled'; record.durationSeconds = composition.durationFrames / composition.fps;
    await writeFile(join(directory, 'video.md'), result.markdown);
    await writeFile(join(directory, 'video.plan.json'), JSON.stringify(result.plan, null, 2));
    await writeFile(join(directory, 'composition.json'), JSON.stringify(composition, null, 2));
    const review = await reviewComposition(composition, { baseDir: directory });
    await writeFile(join(directory, 'review.png'), review.sheet);
    record.reviewErrors = review.issues.filter(issue => issue.severity === 'error');
    record.reviewWarnings = review.issues.filter(issue => issue.severity === 'warning');
    record.status = record.reviewErrors.length ? 'review-failed' : 'reviewed';
    if (process.argv.includes('--render') && !record.reviewErrors.length) {
      await renderMedia(composition, { baseDir: directory, output: join(directory, 'draft.mp4'), scale: 0.5, preset: 'ultrafast', motionBlur: false });
      record.encodedReview = await reviewRenderedVideo(join(directory, 'draft.mp4'), { expectedDurationSeconds: record.durationSeconds });
      record.creativeQuality = 'unassessed';
      record.status = record.encodedReview.issues.some((issue: any) => issue.severity === 'error') ? 'encoded-review-failed' : 'rendered';
    }
  } catch (error) { record.error = (error as Error).message.replaceAll(key, '[redacted]').slice(0, 1800); }
  record.totalSeconds = (Date.now() - started) / 1000;
  console.log(`${model}: ${record.status}, ${record.calls} calls, ${record.totalSeconds.toFixed(1)}s`);
  await writeFile(join(output, 'report.json'), JSON.stringify({ provider: providerId, brief, modelsAvailable: available, records }, null, 2));
}
console.log(`Report: ${join(output, 'report.json')}`);
