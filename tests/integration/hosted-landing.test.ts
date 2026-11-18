import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { request, type Server } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, createAccounts, createQuotas, MemoryUserStore } from '@ove/api';
import { InProcessQueue, createJobRunner } from '@ove/jobs';
import { FsProjectStore } from '@ove/storage';
import { jobEnvFor, studioLibrary, studioPlayer } from '../../packages/cli/src/ai-studio';
import { createProvider } from '@ove/ai';
import { makeThumbnail } from '../../packages/cli/src/thumbnail';

// With a landing page the hosted API shows it at "/" and keeps the web app at "/app/": one host serves both, with no separate web server. Without one the
// web app is at "/" as before. The page, its clips and the app's files are open to everyone; the API behind them is not.
const HOST = 'landing.test', ORIGIN = 'http://landing.test';
let root = '', withLanding: Server, withoutLanding: Server, portA = 0, portB = 0;
type Reply = { status: number; headers: Record<string, string | string[] | undefined>; text: string };
const get = (port: number, path: string): Promise<Reply> => new Promise((ok, fail) => {
  const req = request({ host: '127.0.0.1', port, method: 'GET', path, headers: { host: HOST } }, res => {
    const chunks: Buffer[] = []; res.on('data', c => chunks.push(c));
    res.on('end', () => ok({ status: res.statusCode!, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
  });
  req.on('error', fail); req.end();
});

async function serve(port: number, landing?: { dir: string }, appDir = '') {
  const store = new FsProjectStore(join(root, `store-${port}`)), users = new MemoryUserStore(), provider = createProvider({ provider: 'mock' });
  const runner = createJobRunner(jobEnvFor(store, () => provider, () => ({ provider: provider.id, model: provider.model }), false));
  const queue = new InProcessQueue(runner.run);
  const auth = createAccounts({ users, publicOrigin: ORIGIN, appPath: landing ? '/app' : '', mailer: { send: async () => {} } });
  const quotas = createQuotas({ users, storageUsed: who => store.usedBytes(who), limits: { maxProjects: 3, maxUploadBytes: 1000, jobsPerDay: { ai: 2, render: 1 } } });
  const app = createApp({ mode: 'hosted', store, queue, validate: runner.validate, auth, quotas, library: studioLibrary, player: studioPlayer, app: { dir: appDir, fallbackPage: '<p>FALLBACK PAGE</p>' }, ...(landing ? { landing } : {}),
    makeThumbnail, providerState: () => ({ provider: { id: 'mock' }, error: null }), allowHosts: [HOST], publicOrigin: ORIGIN });
  return (await app.listen({ host: '127.0.0.1', port })).server;
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'ove-landing-'));
  await mkdir(join(root, 'landing', 'media'), { recursive: true }); await mkdir(join(root, 'app', 'assets'), { recursive: true });
  await writeFile(join(root, 'landing', 'index.html'), '<!doctype html><title>LANDING PAGE</title><a href="/app/">Open the app</a>');
  await writeFile(join(root, 'landing', 'media', 'clip.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  await writeFile(join(root, 'secret.txt'), 'not for the web');
  await writeFile(join(root, 'app', 'index.html'), '<!doctype html><title>APP INDEX</title><script src="/assets/app.js"></script>');
  await writeFile(join(root, 'app', 'assets', 'app.js'), 'console.log("app")');
  withLanding = await serve(3611, { dir: join(root, 'landing') }, join(root, 'app')); portA = 3611;
  withoutLanding = await serve(3612, undefined, join(root, 'app')); portB = 3612;
});
afterAll(async () => { for (const s of [withLanding, withoutLanding]) { s?.close(); s?.closeAllConnections(); } if (root) await rm(root, { recursive: true, force: true }); });

describe('the landing page served by the hosted API', () => {
  it('shows the landing page at the front door, to anyone', async () => {
    const reply = await get(portA, '/');
    expect(reply.status).toBe(200);
    expect(reply.headers['content-type']).toMatch(/text\/html/);
    expect(reply.text).toContain('LANDING PAGE');
  });

  it('serves its media folder, and nothing outside it', async () => {
    expect((await get(portA, '/media/clip.jpg')).status).toBe(200);
    expect((await get(portA, '/media/missing.mp4')).status).toBe(404);
    for (const path of ['/media/..%2fsecret.txt', '/media/..%2f..%2fsecret.txt', '/media/%2e%2e/secret.txt']) {
      const reply = await get(portA, path);
      expect(reply.status, path).toBe(404);
      expect(reply.text).not.toContain('not for the web');
    }
  });

  it('keeps the web app at /app/, with its files where its own page asks for them', async () => {
    const redirect = await get(portA, '/app');
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe('/app/');
    const page = await get(portA, '/app/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('APP INDEX');
    expect((await get(portA, '/assets/app.js')).text).toContain('console.log');
  });

  it('is not the page without a landing folder: the web app is at / as before', async () => {
    expect((await get(portB, '/')).text).toContain('APP INDEX');
  });

  it('still turns away the API from anyone who is not signed in', async () => {
    expect((await get(portA, '/api/projects')).status).toBe(401);
  });
});
