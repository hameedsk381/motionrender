import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AGENT_TOOLS, handleAgentTool } from '../../packages/cli/src/mcp-agent-tools';

// motionrender_init starts the code-first project by default, like `mr init`, and the composition starter only on request.
let root = '';
beforeAll(async () => { root = await mkdtemp(join(tmpdir(), 'ove-mcp-init-')); });
afterAll(() => rm(root, { recursive: true, force: true }));

describe('motionrender_init', () => {
  it('starts a video.tsx by default and a composition.json on request', async () => {
    const code = await handleAgentTool('motionrender_init', { dir: join(root, 'code') });
    expect(existsSync(join(root, 'code', 'video.tsx'))).toBe(true);
    expect(existsSync(join(root, 'code', 'composition.json'))).toBe(false);
    expect((code?.content[0] as { text: string }).text).toMatch(/Write video\.tsx/);
    await handleAgentTool('motionrender_init', { dir: join(root, 'json'), composition: true });
    expect(existsSync(join(root, 'json', 'composition.json'))).toBe(true);
    expect(existsSync(join(root, 'json', 'video.tsx'))).toBe(false);
  });

  it('describes both starters and the composition option', () => {
    const tool = AGENT_TOOLS.find(item => item.name === 'motionrender_init')!;
    expect(tool.description).toMatch(/video\.tsx/);
    expect(Object.keys((tool.inputSchema as any).properties)).toContain('composition');
  });
});
