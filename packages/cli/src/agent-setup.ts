// Making a folder ready for an agent: instructions it reads on its own (AGENTS.md for Codex and most agents, CLAUDE.md for Claude Code), the skills,
// and the MCP server configured for each client. `mr init` uses it for a new project and `mr setup` for an existing folder. Nothing here touches a
// user-level config file: those are printed by `mr mcp --config <client>` for the person to apply.
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { skillsRoot } from './init';

export const MCP_COMMAND = { command: 'npx', args: ['-y', 'motionrender', 'mcp'] };
/** For a machine or image that already has motionrender installed: no download on first use. */
export const MCP_COMMAND_LOCAL = { command: 'mr', args: ['mcp'] };
export type McpClient = 'claude-code' | 'claude-desktop' | 'codex' | 'cursor';
export const mcpClients: McpClient[] = ['claude-code', 'claude-desktop', 'codex', 'cursor'];

const START = '<!-- motionrender:start -->', END = '<!-- motionrender:end -->';

/** The instructions an agent reads before making a video: what to run, in what order, and how to know it is right. */
export const agentInstructions = (): string => `${START}
# MotionRender: making videos

MotionRender (\`motionrender\`, short \`mr\`) turns JSON into frame-exact video. You write the JSON; the engine draws, times, checks and renders it. **You are the model: nothing here needs an AI key.** The \`mr ai\` commands are optional.

## Pick the route
1. **Code (the default for any video about a topic)**: write a \`video.tsx\`, a React component, so the layout is made for THIS content and not taken from a fixed set of scenes. Start with \`mr init <dir>\` (it scaffolds this route), install what the build needs once (\`npm install --save-dev esbuild react react-dom\` in that folder; without them \`mr make\` stops and says so), then \`mr make video.tsx\` (builds, reviews, draws \`review.png\`) and \`mr render video.tsx --output out.mp4\`. There is no composition.json to keep: the build lives in a hidden \`.motionrender/\` folder. Use the kit from \`motionrender/react\` and read the \`ove-react-video\` skill first.
   **Let the content decide the layout, the colours and the type, in this order:** (1) find the one picture that tells the story and make it the page: a falling cost is a chart that fills the frame with the story pinned to it, a process is a path with stops, a comparison is two halves, a single figure is giant type, a history is a line you travel along; do not stack headline, cards and a button. (2) Take the palette and type from the subject (news: cream, ink and one red with a serif; security: black and phosphor with mono; climate: deep green and gold; a brand: its own colours) and use them with one accent. (3) Decide the pace from the beats of the story, not a fixed count. Two videos on different topics must not share a page structure; if yours looks like the last one, start the layout again.
   **Give each scene a picture of its own subject, not only text and shapes:** (a) \`<Illustration name="ballot" color=... ink=... paper=... delay={frame} />\` from \`motionrender/react\` draws one of 20 subjects in your colours, no key or file needed (\`server, phone, laptop, person, building, document, bars, globe, ballot, tree, shield, lock, coin, bolt, sun, panel, cloud, heart, bulb, truck\`); for a subject it lacks, draw your own SVG in the same flat style (outline in ink, one accent fill); (b) \`mr stock "solar panels" --kind photo|video --aspect 9:16\` saves a real photo or clip under assets/ with its credit in assets/credits.json (needs a free PIXABAY_API_KEY), then declare it in \`config.assets\` as the command prints (a picture or clip is used by its id: \`<Img src="photo-22" />\`, \`<Video src="video-31" muted />\`; an undeclared picture renders as nothing, and \`mr make\` reports it as an error) and show the credit. Use a real picture where the subject is a real place or thing, an illustration where it is an idea or a process.
   Rules the design review enforces, so write to them from the start: labels 24px+, body text 26px+, lineHeight 1.2+ on large type, one scale of 5-8 font sizes with no near-equal pairs, about 40 words or fewer on screen, contrast 3:1+, text out of the top 8%, bottom 18% and right 11% of a 9:16 frame, \`export.loudness\` set in \`config\` (-16, or -14 for vertical social), and enough frames in each \`sfx:\` \`<Sequence>\`. For a spoken narration, record each line with \`mr voice "<what is said>"\` (a free Edge voice: needs internet, no key; it saves the audio and the time of every word under assets/ and prints the length in frames and the lines to paste), cut each scene to its line (a stop, a number or a picture appears as its line begins), lower the music bed to about 0.25, and use \`<Captions words={...} />\` from \`motionrender/react\` for word-by-word captions.
2. **Explainer** (a quick narrated video that teaches one idea from a fixed set of scene kinds, with spoken lines: fast, but every video shares the same scene library, so use it for drafts and short lessons, not for a video that must look made for its subject): write an \`explainer.json\`. Run \`mr explainer kinds\` for the scene kinds and an example of each, and \`mr schema --explainer\` for every field. This is the fastest route to something good.
   **Art-direct every scene from its content, do not leave it all to auto:** a scene's \`variant\` (\`mr schema --explainer\`, and \`mr explainer kinds\` for what each kind can be) decides how its content is drawn, so pick it for what the scene says: steps with details as a \`ladder\`, five short steps as a \`list\`, two options as \`versus\`, a share as a \`ring\`. Leave a scene on auto only when the engine's pick fits; it then varies the drawing by topic. Mix scene kinds across the video (a stat, a chart, a quote, a route) rather than the same card three times, and set \`design\` fields (\`header\`, \`progress\`, \`captions\`, \`layout\`) to suit the subject.
   **Start from the subject's own sequence, not a stock list of scenes:** \`mr explainer outline "<what the video explains>"\` proposes which scene kinds the subject calls for and in what order (a process wants steps or a route, a comparison two sides, a figure a stat and a chart, a history a timeline), with the drawings each can take. It proposes fewer scenes when the brief supports fewer; do not pad. Write the script against it, changing it where you know the story better.
   **The look is made from the subject:** \`look\` defaults to \`auto\`, which reads what the script is about, takes the family of design its words point to (news reads as newsprint, security as terminal, climate as forest), then turns its colours and chooses its type, texture, motion, transition, header, progress bar and captions from that subject, so two videos on different subjects do not share a board. Leave it on \`auto\` unless the brief names a look or brand; \`mr explainer looks\` lists the 13 fixed designs you can name instead, and \`design\` and \`colors\` in the script change parts of any look.
   An explainer script needs \`topic\` and, for a \`route\` scene, a \`cue\` and at most 8 stops in \`via\`; set \`handle\` and keep \`topic\` short so the header does not collide. Check the voiced build too: captions can overlap a scene that a silent build passes.
3. **Composition** (anything else: reels, promos, product videos, kinetic type): write a \`composition.json\` against \`mr schema\`. Start from \`mr init <dir>\` and add ready-made scenes with \`mr add\` (\`mr blocks\` lists them) rather than from nothing.

## The loop (two calls, not eight)
1. Write the video (\`video.tsx\`), the script or the composition.
2. \`mr make video.tsx\` (or \`explainer.json\`, \`composition.json\`; MCP: \`motionrender_make_video\`). One call validates it, builds \`composition.json\`, runs the design review and draws ONE contact sheet of the whole video (\`review.png\`), and lists every problem with where it is. **Open the contact sheet**, fix what it lists, run it again. Add \`--no-voice\` while iterating: it is silent and faster.
3. When the sheet is right, \`mr make explainer.json --draft\` renders a quick half-size MP4 to check how it moves (about twice as fast as the final), then \`mr make explainer.json --final\` writes \`out.mp4\`. Nothing is rendered over review errors. The finished file is then read back, and anything wrong with it is listed as \`VIDEO ERROR\` or \`video warn\` lines: the wrong size or length, sound that is missing, silent or off its loudness target, a black stretch, a picture that stops changing for most of the video. Fix those and render again; do not hand over a video that lists a \`VIDEO ERROR\`.
Never say a video is done before you have looked at the contact sheet. The single steps still exist when you want one thing only: \`mr explainer validate\`, \`mr explainer compile\`, \`mr still composition.json --frame 90\`, \`mr review\`, \`mr render\`.

## Facts, pictures, voices
- Numbers must be real, never from memory. Look them up (no key needed): \`mr facts country India,Brazil internet_users\`, \`mr facts wikipedia "Load balancing"\`, \`mr facts exchange USD INR\` (\`mr facts indicators\` lists the figures; add \`--json\`), or the \`motionrender_facts\` tool. Every fact has a source and date: put it in the scene's note or caption and in the script's \`sources\`. If a lookup fails, say so and leave the number out; do not guess.
- A media scene takes a file from the project (\`assets/...\`) a \`prompt\` (needs an image model: \`--images\`), or \`stock\` search words (\`stockKind\`: photo or video), which finds real footage on Pixabay or Pexels when the video is built, in the video's shape, and credits it: it needs a free key in PIXABAY_API_KEY (or PEXELS_API_KEY; Pexels is not giving out new keys at present). The choice is kept in assets/, with assets/credits.json listing every credit. The studio's Media tab searches too.
- Voices: the free Edge voices, which need internet but no key: \`en-IN-NeerjaNeural\`, \`en-US-AriaNeural\`, \`hi-IN-SwaraNeural\`, \`te-IN-ShrutiNeural\` (set \`voice\` in the script; \`voiceRate\` speeds it up or slows it down, +12 suits a promo). \`--no-voice\` builds silently.

## Tools (MCP)
The same things are available as MCP tools. Start with \`motionrender_make_video\` (check, build, review and one contact sheet in a single call, optional draft or final render). The single steps: \`motionrender_schema\`, \`motionrender_explainer_kinds\`, \`motionrender_explainer_validate\`, \`motionrender_explainer_compile\`, \`motionrender_facts\` (or \`mr facts\`), \`motionrender_validate\`, \`motionrender_render_still\`, \`motionrender_review_video\`, \`motionrender_render_video\`, \`motionrender_environment\` (run it first if a render fails). Configure them with \`mr mcp --config <claude-code|codex|cursor|claude-desktop>\`.

## Good to know
- Before choosing timing, easing, staggers or an animation style, read the \`motion-design\` skill (one personality per video, easing and duration tables, a quality checklist). For footage work beyond \`mr ai edit\` (HDR tone mapping, stabilising, multicam, lossless cuts, platform checks) the companion ffmpeg-skill (\`npx ffmpeg-skill\`, MIT, local, needs Python and FFmpeg) is a good fit: ask the user before installing it, because it writes to their skills folder.
- 9:16 is the default. Keep text out of the top 8%, bottom 18% and right 11% (platform buttons cover them); \`mr review\` flags it.
- One idea per scene, a spoken line per scene, five to eight scenes. Scenes last as long as their line.
- Code layers (\`code\`, \`react\`, \`p5\`) run JavaScript while rendering and need \`--allow-code\`, for files you trust. \`model\` (3D .glb), \`physics\`, \`sketch\` and \`shader\` do not.
- First render on a machine: \`mr doctor\` checks Node 22+, FFmpeg and the browser; \`mr browser install\` fetches Chromium.
- Skills with the detail are in \`.claude/skills\` and \`.agent/skills\` (start with \`ove\`, then \`ove-explainer\`).
${END}
`;

const claudeInstructions = (): string => `${START}
# MotionRender

@AGENTS.md

For Claude Code: the MotionRender MCP server is configured in \`.mcp.json\` (approve it when asked), and the skills are in \`.claude/skills\`.
${END}
`;

/** Writes the block into a file, replacing an earlier MotionRender block and leaving the rest of the file alone. */
async function putBlock(file: string, block: string, force: boolean): Promise<'created' | 'updated' | 'kept'> {
  if (!existsSync(file)) { await mkdir(dirname(file), { recursive: true }); await writeFile(file, block); return 'created'; }
  const current = await readFile(file, 'utf8'), from = current.indexOf(START), to = current.indexOf(END);
  if (from >= 0 && to > from) { await writeFile(file, current.slice(0, from) + block.trimEnd() + current.slice(to + END.length)); return 'updated'; }
  if (current.includes('MotionRender') && !force) return 'kept';
  await writeFile(file, `${current.trimEnd()}\n\n${block}`);
  return 'updated';
}

/** Adds the MotionRender server to a {"mcpServers": {...}} file (.mcp.json, .cursor/mcp.json), keeping every other server. */
async function putMcpJson(file: string, command: { command: string; args: string[] }): Promise<'created' | 'updated'> {
  let data: { mcpServers?: Record<string, unknown> } = {}, existed = false;
  if (existsSync(file)) { existed = true; try { data = JSON.parse(await readFile(file, 'utf8')); } catch { throw new Error(`${file} is not valid JSON; fix it or remove it, then run setup again`); } }
  data.mcpServers = { ...data.mcpServers, motionrender: command };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
  return existed ? 'updated' : 'created';
}

const codexBlock = (command: { command: string; args: string[] }) => `[mcp_servers.motionrender]\ncommand = "${command.command}"\nargs = [${command.args.map(arg => `"${arg}"`).join(', ')}]\n`;
const CODEX_BLOCK = codexBlock(MCP_COMMAND);

async function putCodexToml(file: string, command: { command: string; args: string[] }): Promise<'created' | 'updated' | 'kept'> {
  if (existsSync(file)) {
    const current = await readFile(file, 'utf8');
    if (current.includes('[mcp_servers.motionrender]')) return 'kept';
    await writeFile(file, `${current.trimEnd()}\n\n${codexBlock(command)}`);
    return 'updated';
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, codexBlock(command));
  return 'created';
}

export type SetupOptions = { force?: boolean; skills?: boolean; /** The server is started with the installed `mr mcp`, not `npx -y motionrender mcp`. */ local?: boolean };

/** Makes a folder ready for agents. Returns what was written, one line each. */
export async function setupAgents(dir: string, options: SetupOptions = {}): Promise<string[]> {
  const out: string[] = [], note = (file: string, what: string) => out.push(`${what.padEnd(8)} ${relative(dir, file) || file}`);
  const agents = join(dir, 'AGENTS.md'), claude = join(dir, 'CLAUDE.md');
  note(agents, await putBlock(agents, agentInstructions(), options.force === true));
  note(claude, await putBlock(claude, claudeInstructions(), options.force === true));
  const command = options.local ? MCP_COMMAND_LOCAL : MCP_COMMAND;
  note(join(dir, '.mcp.json'), await putMcpJson(join(dir, '.mcp.json'), command));
  note(join(dir, '.cursor', 'mcp.json'), await putMcpJson(join(dir, '.cursor', 'mcp.json'), command));
  note(join(dir, '.codex', 'config.toml'), await putCodexToml(join(dir, '.codex', 'config.toml'), command));
  if (options.skills !== false) {
    await cp(skillsRoot, join(dir, '.claude', 'skills'), { recursive: true, force: true });
    await cp(skillsRoot, join(dir, '.agent', 'skills'), { recursive: true, force: true });
    out.push('written  .claude/skills and .agent/skills');
  }
  return out;
}

/** The MCP configuration for one client, as text to apply (user-level files are never edited for you). */
export function mcpConfig(client: McpClient): string {
  switch (client) {
    case 'claude-code': return `# Claude Code (this project, shared through .mcp.json)\nclaude mcp add --scope project motionrender -- npx -y motionrender mcp\n# or just for you:\nclaude mcp add motionrender -- npx -y motionrender mcp`;
    case 'claude-desktop': return `# Claude Desktop: add to claude_desktop_config.json\n# (Windows: %APPDATA%\\Claude\\claude_desktop_config.json, macOS: ~/Library/Application Support/Claude/claude_desktop_config.json)\n${JSON.stringify({ mcpServers: { motionrender: MCP_COMMAND } }, null, 2)}`;
    case 'codex': return `# Codex: one command\ncodex mcp add motionrender -- npx -y motionrender mcp\n# or add to ~/.codex/config.toml (or .codex/config.toml in a trusted project)\n${CODEX_BLOCK.trimEnd()}`;
    case 'cursor': return `# Cursor: add to .cursor/mcp.json (this project) or ~/.cursor/mcp.json\n${JSON.stringify({ mcpServers: { motionrender: MCP_COMMAND } }, null, 2)}`;
  }
}
