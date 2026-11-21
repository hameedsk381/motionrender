// A render writes its output and, for a video with sound, a mastered audio file in the temp folder. On a nearly full drive it used to fail part-way, minutes in,
// with a bare ENOSPC. This checks first and says what to do. `OVE_MIN_FREE_MB` raises or lowers the floor (0 turns the check off).
import { statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { parse, resolve } from 'node:path';

/** Free space, in bytes, on the drive that holds `path` (the nearest folder that exists); undefined when the system will not say. */
export async function freeBytes(path: string): Promise<number | undefined> {
  let at = resolve(path);
  for (let i = 0; i < 32; i++) {
    try { const stat = await statfs(at); return Number(stat.bavail) * Number(stat.bsize); } catch { const up = resolve(at, '..'); if (up === at) return undefined; at = up; }
  }
  return undefined;
}

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

/** A sentence saying the drive is too full for the render, or undefined when there is room (or the free space cannot be read). */
export async function diskSpaceProblem(path: string, minBytes: number, what: string): Promise<string | undefined> {
  const free = await freeBytes(path);
  if (free === undefined || free >= minBytes) return undefined;
  const drive = parse(resolve(path)).root || resolve(path);
  return `Only ${mb(free)} is free on ${drive} (${what} needs ${mb(minBytes)}): free some space there, or write the video to another drive (--output D:\\videos\\out.mp4) and point the temp folder at it (set TEMP and TMP) before rendering.`;
}

/** The floor for a render: 500 MB for the output's drive and 300 MB for the temp folder's, or `OVE_MIN_FREE_MB` for both. */
export async function checkRenderDiskSpace(outputDir: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const override = env.OVE_MIN_FREE_MB === undefined ? undefined : Number(env.OVE_MIN_FREE_MB);
  if (override !== undefined && Number.isFinite(override) && override <= 0) return;
  const outputMin = (override ?? 500) * 1024 * 1024, tempMin = (override ?? 300) * 1024 * 1024;
  const problem = await diskSpaceProblem(outputDir, outputMin, 'this render') ?? await diskSpaceProblem(tmpdir(), tempMin, 'the temp files of this render');
  if (problem) throw new Error(problem);
}
