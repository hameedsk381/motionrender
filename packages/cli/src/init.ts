import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compositionJsonSchema, loadComposition } from '@ove/schema';
import { setupAgents } from './agent-setup';
export const starterDir = fileURLToPath(new URL('../starter', import.meta.url));
export const skillDir = fileURLToPath(new URL('../skills/ove', import.meta.url));
/** Every skill folder: the main `ove` guide and the task guides (reels, voiceover, batches, AI). */
export const skillsRoot = fileURLToPath(new URL('../skills', import.meta.url));
/** The code-first starter: one readable video.tsx and a logo, with no composition.json. */
export const starterReactDir = fileURLToPath(new URL('../starter-react', import.meta.url));
export type InitOptions = { force?: boolean; skill?: boolean; /** Start with a React video (video.tsx) instead of a composition.json. */ react?: boolean };
const isEmptyDir = async (dir: string) => { try { return (await readdir(dir)).length === 0; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; throw error; } };
async function listFiles(dir: string): Promise<string[]> { return (await readdir(dir, { recursive: true, withFileTypes: true })).filter(e => e.isFile()).map(e => join(e.parentPath, e.name)); }
// Scaffolds a renderable project: composition.json, its JSON Schema, starter assets and (by default) the OVE agent skill.
export async function initProject(dir: string, options: InitOptions = {}): Promise<string[]> {
  const target = resolve(dir);
  if (!options.force && !(await isEmptyDir(target))) throw new Error(`${target} is not empty; pass --force to write into it anyway`);
  await mkdir(target, { recursive: true });
  if (options.react) {
    // A video is written as code: video.tsx. The build keeps its work in a hidden .motionrender/ folder, which git is told to ignore.
    await cp(starterReactDir, target, { recursive: true, force: true });
    await cp(join(starterDir, 'assets'), join(target, 'assets'), { recursive: true, force: true });
    await writeFile(join(target, '.gitignore'), '.motionrender/\nout.mp4\ndraft.mp4\nreview.png\n');
    if (options.skill !== false) {
      await setupAgents(target, { force: true });
      await writeFile(join(target, '.cursorrules'), '# MotionRender\nRead AGENTS.md: it says how to make videos here, and .agent/skills has the detail. This project is code-first: the video is video.tsx.\n');
    }
    return (await listFiles(target)).map(file => relative(target, file)).sort();
  }
  await cp(starterDir, target, { recursive: true, force: true });
  const compositionPath = join(target, 'composition.json');
  const name = basename(target);
  const composition = JSON.parse((await readFile(compositionPath, 'utf8')).replace(/^\uFEFF/, ''));
  composition.id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video';
  composition.name = name;
  loadComposition(composition);
  await writeFile(compositionPath, JSON.stringify(composition, null, 2) + '\n');
  await writeFile(join(target, 'composition.schema.json'), JSON.stringify(compositionJsonSchema, null, 2) + '\n');
  if (options.skill !== false) {
    // Instructions for Claude Code (CLAUDE.md), Codex and most agents (AGENTS.md), the MCP server for each client, and the skills.
    await setupAgents(target, { force: true });
    await writeFile(join(target, '.cursorrules'), '# MotionRender\nRead AGENTS.md: it says how to make videos here, and .agent/skills has the detail.\n');
  }
  return (await listFiles(target)).map(file => relative(target, file)).sort();
}
