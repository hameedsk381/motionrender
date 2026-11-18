// MCP tools and resources for agents that write videos themselves (Claude Code, Codex, Cursor and any other): the agent is the model, so none of
// these needs an AI provider key. It reads the schema and the scene kinds, writes the script, and these tools check it, look up real facts,
// build it and report what is wrong. The AI-writer tools in mcp.ts remain for clients that want the engine to do the writing.
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { compositionJsonSchema, explainerJsonSchema, explainerKindDocs, explainerSchema, videoPlanJsonSchema, videoPlanSchema, type Explainer } from '@ove/schema';
import { checkFfmpeg, compileVideoPlan, createReleaseManifest, describeBrowser, diffVideoPlans, editVideoPlan, parseVideoMarkdown, planCollaborationStatus, proposePlanRepairs, recommendPlanAssets, recommendScenes, reviewPlanAssets, reviewVideoPlan, sceneCatalog, videoPlanSummary } from '@ove/core';
import { gatherFacts, lookupSchema } from '@ove/ai';
import { buildExplainer } from './explainer';
import { makeReport, makeVideo, type MakeRender } from './make';
import { initProject, skillsRoot } from './init';

type ToolResult = { content: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[]; isError: boolean };
const reply = (text: string, isError = false): ToolResult => ({ content: [{ type: 'text', text }], isError });
const json = (value: unknown) => JSON.stringify(value, null, 2);

const scriptInput = {
  file: { type: 'string', description: 'Path to an explainer script (explainer.json)' },
  script: { type: 'object', description: 'The explainer script itself, instead of a file (see motionrender_explainer_kinds for the scenes)' },
};
const planInput = {
  file: { type: 'string', description: 'Path to a semantic video plan (video.plan.json)' },
  plan: { type: 'object', description: 'The semantic video plan itself: beats, intent, narration, optional media and style; it has no coordinates or keyframes.' },
  markdown: { type: 'string', description: 'A video.md semantic plan. Headings are beats; use labelled lines such as Intent:, Duration:, On-screen:, Narration:, Claim:, Source:, and Visual:.' },
};

export const AGENT_TOOLS = [
  {
    name: 'motionrender_make_video',
    description: 'THE QUICK PATH: check, build and review a video in ONE call, and optionally render it. Give an explainer script, semantic video plan, or composition file. It validates, builds composition.json, runs the design review and returns every problem at once with its path, plus ONE contact-sheet image of the whole video, so no separate validate, compile, still or review calls are needed. Fix what it lists and call it again. render: "draft" makes a quick half-size MP4 to check the motion, "final" the full-quality video; leave it out while you are still fixing problems. Nothing is rendered over review errors.',
    inputSchema: { type: 'object', properties: { ...scriptInput, outputDir: { type: 'string', description: 'Where explainer.json and the results go (required with an inline script)' }, render: { type: 'string', enum: ['none', 'draft', 'final'], description: 'Render after the checks (default none)' }, voice: { type: 'boolean', description: 'Record the explainer lines with the free Edge voice (default true; false is faster and silent)' }, voiceName: { type: 'string' }, output: { type: 'string', description: 'The MP4 path (default draft.mp4 or out.mp4 beside the file)' }, allowCode: { type: 'boolean', description: 'Run react, code and p5 layers (only for files you trust)' } } },
  },
  {
    name: 'motionrender_schema',
    description: 'The JSON Schema for a MotionRender composition or an explainer script. Read it before writing either by hand; it lists every field, default and limit.',
    inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['composition', 'explainer', 'video-plan'], description: 'Which schema (default composition)' } } },
  },
  {
    name: 'motionrender_plan_validate',
    description: 'Validate a semantic video plan. Plans describe beats, their communication intent, narration, optional media and style—not renderer coordinates or keyframes. Give a file or the plan inline.',
    inputSchema: { type: 'object', properties: planInput },
  },
  {
    name: 'motionrender_plan_compile',
    description: 'Compile a semantic video plan into the deterministic composition.json render target. Beats with no media become editable text-card placeholders, so an agent can establish the narrative before sourcing or generating visuals.',
    inputSchema: { type: 'object', properties: { ...planInput, outputDir: { type: 'string', description: 'Where composition.json goes; required with an inline plan.' } } },
  },
  {
    name: 'motionrender_plan_edit',
    description: 'Apply intent-preserving changes to a semantic video plan and return the refined plan plus a beat-level diff. Edits address beat ids—not generated composition layers—so copy, timing, ordering, media direction and style stay reversible.',
    inputSchema: { type: 'object', properties: { ...planInput, edits: { type: 'array', description: 'Semantic operations: update-beat, insert-beat, remove-beat, move-beat, update-brief, or set-style.', items: { type: 'object' } } }, required: ['edits'] },
  },
  {
    name: 'motionrender_plan_diff',
    description: 'Compare two semantic video plans before recompiling. Returns added, removed, moved and changed beats; evidence/source changes; style changes; and duration impact. It never writes or renders.',
    inputSchema: { type: 'object', properties: { before: { type: 'object', description: 'The original semantic video plan.' }, after: { type: 'object', description: 'The proposed semantic video plan.' } }, required: ['before', 'after'] },
  },
  {
    name: 'motionrender_plan_review',
    description: 'Run a fast, no-render review of a semantic plan. It checks duration against the brief, rhythm, copy reading time, narration speed, unused evidence, and beats still using visual placeholders.',
    inputSchema: { type: 'object', properties: planInput },
  },
  {
    name: 'motionrender_scene_catalog',
    description: 'List the semantic scene catalog or recommend scene shapes for one beat. Each entry has a communication purpose, when to use or avoid it, and required inputs. Use the chosen id in visual.scene; plan review checks the contract before rendering.',
    inputSchema: { type: 'object', properties: { intent: { type: 'string', description: 'What this beat needs to communicate.' }, onScreen: { type: 'string', description: 'Proposed on-screen copy.' }, visualDirection: { type: 'string', description: 'Proposed visual direction.' }, hasMedia: { type: 'boolean', description: 'Whether an approved media asset is available.' } } },
  },
  {
    name: 'motionrender_plan_assets',
    description: 'Review declared plan assets and rank the best eligible visual assets for each beat (or one beat). Scores explain scene fit, media type, metadata matches, approval status, and rights constraints; no plan is changed.',
    inputSchema: { type: 'object', properties: { ...planInput, beatId: { type: 'string', description: 'Recommend assets for this beat only; omit for every beat.' } } },
  },
  {
    name: 'motionrender_plan_repair',
    description: 'Turn issues returned by a rendered composition review into reversible semantic plan-edit proposals. It maps review frames back to plan beat ids and never writes or applies an edit; inspect the returned edits, then send selected ones to motionrender_plan_edit.',
    inputSchema: { type: 'object', properties: { ...planInput, issues: { type: 'array', description: 'Review issues from motionrender_review_video or mr make, each with severity, code, message, and optional frame/layer.', items: { type: 'object' } } }, required: ['issues'] },
  },
  {
    name: 'motionrender_plan_release',
    description: 'Build a publish handoff manifest for a semantic plan. It records an immutable plan digest, final approval status, output format, variable rows needed for localization/personalization, requested channels, and every blocker. It never publishes or renders.',
    inputSchema: { type: 'object', properties: { ...planInput, channels: { type: 'array', items: { type: 'string' }, description: 'Delivery channels, such as web, youtube, tiktok, linkedin.' }, requireFinalApproval: { type: 'boolean', description: 'Require an approved final checkpoint (default true).' } } },
  },
  {
    name: 'motionrender_plan_status',
    description: 'Return the shared collaboration dashboard for a semantic plan: open/resolved comments by beat, current and append-only approval history, and release readiness/blockers. It is read-only.',
    inputSchema: { type: 'object', properties: { ...planInput, channels: { type: 'array', items: { type: 'string' } } } },
  },
  {
    name: 'motionrender_explainer_kinds',
    description: 'Every explainer scene kind (title, flow, grid, steps, compare, stat, chart, timeline, pile, media, phone, hex, closing): what it shows, when to use it and a valid example. An explainer is the quickest way to a finished vertical video: you write scenes and spoken lines, the engine draws and times them. No AI key needed.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'motionrender_explainer_validate',
    description: 'Check an explainer script and list every problem at once, with the path to each (such as scenes.2.events). Give a file or the script itself.',
    inputSchema: { type: 'object', properties: scriptInput },
  },
  {
    name: 'motionrender_explainer_compile',
    description: 'Build an explainer script into composition.json (then use motionrender_render_still to look at it and motionrender_render_video to make the MP4). Each scene lasts as long as its spoken line. voice: true records the lines with a free Edge voice (needs internet, no key); the default is silent. Media scenes may give a prompt instead of a file, which needs an image model.',
    inputSchema: { type: 'object', properties: { ...scriptInput, outputDir: { type: 'string', description: 'Where composition.json goes (default: beside the file; required with an inline script)' }, voice: { type: 'boolean', description: 'Record the spoken lines (default false)' }, voiceName: { type: 'string', description: 'Edge voice, such as en-IN-NeerjaNeural, en-US-AriaNeural or te-IN-ShrutiNeural' } } },
  },
  {
    name: 'motionrender_facts',
    description: 'Look up real facts to ground a script, from public APIs that need no key: Wikipedia (what a thing is), the World Bank (latest figures for countries: population, gdp, gdp_per_capita, life_expectancy, internet_users, inflation, unemployment, urban_population) and Frankfurter (exchange rates). Each fact comes with its source and date: put them in the scene and in the script\'s "sources". Prefer this to remembering numbers.',
    inputSchema: { type: 'object', properties: { lookups: { type: 'array', description: 'Up to 8 lookups: {"type":"wikipedia","topic":"Load balancing"}, {"type":"country","countries":["India","Brazil"],"indicator":"population"} or {"type":"exchange","base":"USD","quotes":["INR","EUR"]}', items: { type: 'object' } } }, required: ['lookups'] },
  },
  {
    name: 'motionrender_environment',
    description: 'Check that this machine can render: Node, FFmpeg and the browser. Run it first if a render fails; it says what is missing and how to fix it.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'motionrender_init',
    description: 'Start a project folder: a starter composition.json, its JSON Schema, and the agent instructions and skills for Claude Code, Codex and Cursor. Fails if the folder is not empty unless force is true.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string', description: 'Folder to create' }, force: { type: 'boolean' } }, required: ['dir'] },
  },
];

async function readScript(args: Record<string, any>): Promise<{ spec: unknown; dir?: string }> {
  if (args.script !== undefined) return { spec: args.script };
  if (!args.file) throw new Error('Give a file or a script');
  const file = resolve(String(args.file));
  return { spec: JSON.parse((await readFile(file, 'utf8')).replace(/^﻿/, '')), dir: dirname(file) };
}

async function readPlan(args: Record<string, any>): Promise<{ spec: unknown; dir?: string }> {
  if (args.plan !== undefined) return { spec: args.plan };
  if (args.markdown !== undefined) return { spec: parseVideoMarkdown(String(args.markdown)) };
  if (!args.file) throw new Error('Give a file or a plan');
  const file = resolve(String(args.file));
  const text = (await readFile(file, 'utf8')).replace(/^﻿/, '');
  return { spec: file.toLowerCase().endsWith('.md') ? parseVideoMarkdown(text) : JSON.parse(text), dir: dirname(file) };
}

const problems = (error: z.ZodError) => error.issues.map(issue => `${issue.path.join('.') || 'script'}: ${issue.message}`);

export async function handleAgentTool(name: string, args: Record<string, any>): Promise<ToolResult | undefined> {
  switch (name) {
    case 'motionrender_schema':
      return reply(json(args.kind === 'explainer' ? explainerJsonSchema : args.kind === 'video-plan' ? videoPlanJsonSchema : compositionJsonSchema));

    case 'motionrender_plan_validate': {
      const { spec } = await readPlan(args), parsed = videoPlanSchema.safeParse(spec);
      if (!parsed.success) return reply(`The video plan cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      const summary = videoPlanSummary(parsed.data);
      return reply(`Valid video plan "${parsed.data.name}": ${summary.beats} beats, ${summary.seconds.toFixed(1)} s, ${summary.placeholders} editable placeholder${summary.placeholders === 1 ? '' : 's'}.`);
    }

    case 'motionrender_plan_compile': {
      const { spec, dir } = await readPlan(args), parsed = videoPlanSchema.safeParse(spec);
      if (!parsed.success) return reply(`The video plan cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      const target = args.outputDir ? resolve(String(args.outputDir)) : dir;
      if (!target) throw new Error('outputDir is required when the plan is given inline');
      await mkdir(target, { recursive: true });
      const built = compileVideoPlan(parsed.data), output = join(target, 'composition.json');
      await writeFile(output, JSON.stringify(built.composition, null, 2) + '\n');
      return reply(`Compiled ${parsed.data.beats.length} semantic beats to ${output}${built.notes.length ? `\nNotes:\n${built.notes.map(note => `- ${note}`).join('\n')}` : ''}`);
    }

    case 'motionrender_plan_edit': {
      const { spec } = await readPlan(args), parsed = videoPlanSchema.safeParse(spec);
      if (!parsed.success) return reply(`The video plan cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      try {
        const result = editVideoPlan(parsed.data, args.edits);
        return reply(json({ plan: result.plan, changes: result.changes }));
      } catch (error) { return reply(`The plan edits cannot be used:\n- ${(error as Error).message}`, true); }
    }

    case 'motionrender_plan_diff': {
      try { return reply(json(diffVideoPlans(args.before, args.after))); }
      catch (error) { return reply(`The plans cannot be compared:\n- ${(error as Error).message}`, true); }
    }

    case 'motionrender_plan_review': {
      const { spec } = await readPlan(args), parsed = videoPlanSchema.safeParse(spec);
      if (!parsed.success) return reply(`The video plan cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      return reply(json({ issues: reviewVideoPlan(parsed.data) }));
    }

    case 'motionrender_scene_catalog': {
      const query = { intent: typeof args.intent === 'string' ? args.intent : undefined, onScreen: typeof args.onScreen === 'string' ? args.onScreen : undefined, visualDirection: typeof args.visualDirection === 'string' ? args.visualDirection : undefined, hasMedia: typeof args.hasMedia === 'boolean' ? args.hasMedia : undefined };
      const requested = query.intent || query.onScreen || query.visualDirection || query.hasMedia !== undefined;
      return reply(json(requested ? recommendScenes(query) : sceneCatalog));
    }

    case 'motionrender_plan_assets': {
      const { spec } = await readPlan(args), parsed = videoPlanSchema.safeParse(spec);
      if (!parsed.success) return reply(`The video plan cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      try {
        const recommendations = args.beatId ? { [String(args.beatId)]: recommendPlanAssets(parsed.data, String(args.beatId)) } : Object.fromEntries(parsed.data.beats.map(beat => [beat.id, recommendPlanAssets(parsed.data, beat.id).slice(0, 3)]));
        return reply(json({ recommendations, issues: reviewPlanAssets(parsed.data) }));
      } catch (error) { return reply((error as Error).message, true); }
    }

    case 'motionrender_plan_repair': {
      const { spec } = await readPlan(args), parsed = videoPlanSchema.safeParse(spec);
      if (!parsed.success) return reply(`The video plan cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      const issues = Array.isArray(args.issues) ? args.issues.filter((issue: any) => issue && typeof issue.code === 'string' && typeof issue.message === 'string' && ['error', 'warning', 'info'].includes(issue.severity)).map((issue: any) => ({ severity: issue.severity, code: issue.code, message: issue.message, ...(Number.isFinite(issue.frame) ? { frame: issue.frame } : {}), ...(typeof issue.layer === 'string' ? { layer: issue.layer } : {}) })) : [];
      if (!issues.length) return reply('issues must contain one or more review findings with severity, code, and message', true);
      return reply(json({ proposals: proposePlanRepairs(parsed.data, issues) }));
    }

    case 'motionrender_plan_release': {
      const { spec } = await readPlan(args), parsed = videoPlanSchema.safeParse(spec);
      if (!parsed.success) return reply(`The video plan cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      const channels = Array.isArray(args.channels) ? args.channels.filter((channel: unknown): channel is string => typeof channel === 'string') : undefined;
      const manifest = createReleaseManifest(parsed.data, { channels, requireFinalApproval: args.requireFinalApproval !== false });
      return reply(json(manifest), manifest.status !== 'ready');
    }

    case 'motionrender_plan_status': {
      const { spec } = await readPlan(args), parsed = videoPlanSchema.safeParse(spec);
      if (!parsed.success) return reply(`The video plan cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      const channels = Array.isArray(args.channels) ? args.channels.filter((channel: unknown): channel is string => typeof channel === 'string') : undefined;
      return reply(json(planCollaborationStatus(parsed.data, { channels })));
    }

    case 'motionrender_make_video': {
      let file = args.file ? resolve(String(args.file)) : undefined;
      if (!file) {
        if (args.script === undefined) throw new Error('Give a file, or a script with outputDir');
        if (!args.outputDir) throw new Error('outputDir is required when the script is given inline');
        const dir = resolve(String(args.outputDir));
        await mkdir(dir, { recursive: true });
        file = join(dir, 'explainer.json');
        await writeFile(file, `${JSON.stringify(args.script, null, 2)}
`);
      }
      const render: MakeRender | undefined = args.render === 'draft' || args.render === 'final' ? args.render : undefined;
      const result = await makeVideo({ file, render, output: args.output, voice: args.voice !== false, voiceName: args.voiceName, allowCode: args.allowCode === true });
      const content: ToolResult['content'] = [{ type: 'text', text: makeReport(result) }];
      if (result.review) { const sheet = await readFile(result.review.sheet); if (sheet.length <= 1_500_000) content.push({ type: 'image', data: sheet.toString('base64'), mimeType: 'image/png' }); }
      return { content, isError: !result.ok };
    }

    case 'motionrender_explainer_kinds':
      return reply(json(explainerKindDocs));

    case 'motionrender_explainer_validate': {
      const { spec } = await readScript(args), parsed = explainerSchema.safeParse(spec);
      if (!parsed.success) return reply(`The script cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      const spoken = parsed.data.scenes.filter(scene => scene.say).length;
      return reply(`Valid explainer "${parsed.data.topic}": ${parsed.data.scenes.length} scenes (${parsed.data.scenes.map(scene => scene.kind).join(', ')}), ${spoken} spoken line${spoken === 1 ? '' : 's'}.`);
    }

    case 'motionrender_explainer_compile': {
      const { spec, dir } = await readScript(args), parsed = explainerSchema.safeParse(spec);
      if (!parsed.success) return reply(`The script cannot be used:\n${problems(parsed.error).map(line => `- ${line}`).join('\n')}`, true);
      const target = args.outputDir ? resolve(String(args.outputDir)) : dir;
      if (!target) throw new Error('outputDir is required when the script is given inline');
      const logs: string[] = [];
      const built = await buildExplainer(parsed.data as Explainer, { output: join(target, 'composition.json'), voice: args.voice === true, voiceName: args.voiceName, log: message => logs.push(message) });
      return reply([`Built ${built.output}`, `- ${built.scenes} scenes, ${built.spoken} spoken line${built.spoken === 1 ? '' : 's'}${args.voice === true ? ' recorded' : ' (silent: pass voice: true to record them)'}`,
        ...(built.pictures.made + built.pictures.reused ? [`- pictures: ${built.pictures.made} drawn, ${built.pictures.reused} reused`] : []), ...logs.filter(line => !/^pictures:/.test(line)).map(line => `- ${line}`), ...built.notes.map(note => `- ${note}`),
        'Next: motionrender_render_still (frame 90) to look at it, motionrender_review_video to check it, then motionrender_render_video.'].join('\n'));
    }

    case 'motionrender_facts': {
      const list = Array.isArray(args.lookups) ? args.lookups.slice(0, 8) : [];
      if (!list.length) throw new Error('lookups is required: a list of wikipedia, country or exchange lookups');
      const lookups = [], skipped: string[] = [];
      for (const item of list) { const parsed = lookupSchema.safeParse(item); if (parsed.success) lookups.push(parsed.data); else skipped.push(`${JSON.stringify(item).slice(0, 100)}: ${problems(parsed.error).join('; ')}`); }
      const { facts, notes } = await gatherFacts(lookups);
      return reply(json({ facts, notes: [...skipped.map(line => `Skipped ${line}`), ...notes] }), !facts.length);
    }

    case 'motionrender_environment': {
      const lines: string[] = [], major = Number(process.versions.node.split('.')[0]);
      lines.push(`${major >= 22 ? 'ok     ' : 'MISSING'} Node ${process.versions.node}${major >= 22 ? '' : ' (22 or later is required)'}`);
      try { const { version, missing } = await checkFfmpeg(); lines.push(`ok      FFmpeg ${version}`); for (const [use, names] of Object.entries(missing)) lines.push(`MISSING FFmpeg encoders for ${use} output: ${names.join(', ')}`); } catch (error) { lines.push(`MISSING FFmpeg: ${(error as Error).message}`); }
      try { lines.push(`ok      Browser ${await describeBrowser()}`); } catch (error) { lines.push(`MISSING Browser: ${(error as Error).message} (install it with: npx motionrender browser install)`); }
      return reply(lines.join('\n'), lines.some(line => line.startsWith('MISSING')));
    }

    case 'motionrender_init': {
      const dir = resolve(String(args.dir || ''));
      if (!args.dir) throw new Error('dir is required');
      const files = await initProject(dir, { force: args.force === true });
      return reply(`Created ${dir} (${files.length} files). Start with composition.json, or write explainer.json (motionrender_explainer_kinds). Instructions for agents are in AGENTS.md and the skills are in .claude/skills and .agent/skills.`);
    }

    default:
      return undefined;
  }
}

/** Skills and schemas as MCP resources, for clients that read them: motionrender://skill/<name>, motionrender://schema/<kind>. */
export async function listResources(): Promise<{ uri: string; name: string; description: string; mimeType: string }[]> {
  const resources = [
    { uri: 'motionrender://schema/composition', name: 'Composition JSON Schema', description: 'Every field of a composition.json', mimeType: 'application/json' },
    { uri: 'motionrender://schema/explainer', name: 'Explainer JSON Schema', description: 'Every field of an explainer script', mimeType: 'application/json' },
    { uri: 'motionrender://schema/video-plan', name: 'Semantic video-plan JSON Schema', description: 'Beat-level authoring without renderer coordinates or keyframes', mimeType: 'application/json' },
  ];
  if (!existsSync(skillsRoot)) return resources;
  for (const entry of await readdir(skillsRoot)) {
    const file = join(skillsRoot, entry, 'SKILL.md');
    if (!(await stat(file).catch(() => undefined))) continue;
    const head = (await readFile(file, 'utf8')).match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? `The ${entry} skill`;
    resources.push({ uri: `motionrender://skill/${entry}`, name: `Skill: ${entry}`, description: head.slice(0, 300), mimeType: 'text/markdown' });
  }
  return resources;
}

export async function readResource(uri: string): Promise<{ uri: string; mimeType: string; text: string }> {
  if (uri === 'motionrender://schema/composition') return { uri, mimeType: 'application/json', text: json(compositionJsonSchema) };
  if (uri === 'motionrender://schema/explainer') return { uri, mimeType: 'application/json', text: json(explainerJsonSchema) };
  if (uri === 'motionrender://schema/video-plan') return { uri, mimeType: 'application/json', text: json(videoPlanJsonSchema) };
  const skill = uri.match(/^motionrender:\/\/skill\/([a-z0-9-]+)$/)?.[1];
  if (!skill) throw new Error(`Unknown resource ${uri}`);
  const file = join(skillsRoot, skill, 'SKILL.md');
  if (!existsSync(file)) throw new Error(`Unknown resource ${uri}`);
  return { uri, mimeType: 'text/markdown', text: await readFile(file, 'utf8') };
}
