import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { skillsRoot } from '../../packages/cli/src/init';
import { setupAgents } from '../../packages/cli/src/agent-setup';

const distributedRoot = resolve(process.cwd(), '.claude', 'skills');
const canonicalSkills = [
  'motion-design', 'motionrender', 'ove', 'ove-agent', 'ove-ai-compose',
  'ove-batch-videos', 'ove-broll-loop', 'ove-code-video', 'ove-data-visualization',
  'ove-effects', 'ove-explainer', 'ove-kinetic-type', 'ove-make-reel', 'ove-motion-graphics',
  'ove-motion-recipes',
  'ove-paper-collage', 'ove-papercut', 'ove-product-demo', 'ove-react-video',
  'ove-reference-video-analysis', 'ove-remotion', 'ove-sound-design',
  'ove-talking-head-editor', 'ove-voiceover-captions', 'ove-webgl-shaders',
];
const skillNames = (root: string) => readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

describe('agent skill registry', () => {
  it('has a complete canonical registry', async () => {
    const names = skillNames(skillsRoot);
    expect(names).toEqual(canonicalSkills);
    for (const name of names) {
      const file = join(skillsRoot, name, 'SKILL.md');
      expect(existsSync(file), `${name} is missing SKILL.md`).toBe(true);
      expect(await readFile(file, 'utf8')).toMatch(/^---\r?\nname:\s*[a-z0-9-]+/);
    }
  });

  it('keeps the checked-in Claude skill bundle synchronized with the canonical registry', async () => {
    expect(skillNames(distributedRoot)).toEqual(skillNames(skillsRoot));
    for (const name of skillNames(skillsRoot)) {
      expect(await readFile(join(distributedRoot, name, 'SKILL.md'), 'utf8')).toBe(
        await readFile(join(skillsRoot, name, 'SKILL.md'), 'utf8'),
      );
    }
  });

  it('copies every canonical skill during project setup', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const folder = await mkdtemp(join(tmpdir(), 'motionrender-skills-'));
    try {
      await setupAgents(folder);
      for (const name of skillNames(skillsRoot)) {
        expect(existsSync(join(folder, '.claude', 'skills', name, 'SKILL.md'))).toBe(true);
        expect(existsSync(join(folder, '.agent', 'skills', name, 'SKILL.md'))).toBe(true);
      }
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
