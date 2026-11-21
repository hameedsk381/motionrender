import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// What the npm package tells a new user must match what the code does: the code-first default, not the JSON-first flow it replaced.
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

describe('the published README', () => {
  const readme = read('packages/ove/README.md');

  it('starts the quickstart code-first, with the install step, and never previews a composition.json that init did not create', () => {
    expect(readme).toMatch(/init my-video\s+# a code-first project/);
    expect(readme).toContain('npm install --save-dev esbuild react react-dom');
    expect(readme).toContain('make my-video/video.tsx');
    const quickstart = readme.slice(readme.indexOf('## Command line'), readme.indexOf('## Node API'));
    expect(quickstart.indexOf('init my-video --composition')).toBeGreaterThan(quickstart.indexOf('dev my-video/composition.json') - 200);   // the JSON preview is shown only with the --composition init
    expect(quickstart).not.toMatch(/init my-video\n(?:.*\n){0,2}.*dev my-video\/composition\.json/);
  });

  it('does not call the engine JSON-first', () => {
    expect(readme).not.toMatch(/JSON-first/);
    expect(read('packages/ove/package.json')).not.toMatch(/JSON-first/);
  });
});

describe('the entry-point skills', () => {
  it('name code-first as the default for a topic video, in the package source and the repo copy', () => {
    for (const path of ['packages/cli/skills/ove/SKILL.md', 'packages/cli/skills/motionrender/SKILL.md', '.claude/skills/ove/SKILL.md', '.claude/skills/motionrender/SKILL.md']) {
      const text = read(path);
      expect(text, path).toContain('Default for a video about a topic: code-first');
      expect(text, path).not.toContain('An OVE video is one JSON file');
    }
  });
});

describe('the command line', () => {
  it('lists video.tsx for mr make, and says what dev needs when its file is missing', () => {
    expect(read('packages/cli/src/index.ts')).toContain('mr make <video.tsx|video.md|explainer.json|composition.json>');
    const run = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'packages/cli/src/index.ts', 'dev', 'nowhere/composition.json'], { encoding: 'utf8' });
    expect(run.status).not.toBe(0);
    expect(run.stderr + run.stdout).toMatch(/does not exist\. dev previews a composition\.json.*mr make nowhere\/video\.tsx/);
  }, 60_000);
});

describe('the package build', () => {
  it('leaves the project\'s planning notes out of the docs it ships', () => {
    const script = read('scripts/build-package.mjs');
    for (const name of ['saas-structure-plan.md', 'video-workflow-benchmark.md', 'design-theme-color-palette-audit.md', 'prompt-motion-ui-guidelines.md']) expect(script).toContain(name);
    expect(read('packages/ove/package.json')).toContain('"guides"');
  });
});
