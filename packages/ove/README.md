# motionrender

A frame-deterministic motion graphics video engine. A video is a React component (`video.tsx`), a JSON composition, or a narrated explainer script; MotionRender renders it in headless Chromium and encodes it with FFmpeg to MP4 (H.264/H.265), WebM (VP9, with transparency), MOV (ProRes), GIF or a folder of PNG frames, and checks the design (type sizes, contrast, safe zones, missing pictures, empty frames) and the finished file before you hand it over. It is made to be driven by an AI agent: `mr init` writes the instructions and skills, and there is an MCP server.

## Requirements

- Node.js 22 or later.
- FFmpeg with ffprobe, on `PATH` (or set `OVE_FFMPEG_PATH` and `OVE_FFPROBE_PATH`).
- `esbuild`, `react` and `react-dom` in your project, for videos written as React: `npm install --save-dev esbuild react react-dom`.
- Chromium for Playwright: `npx playwright install chromium`. On Windows an installed Google Chrome is used if present; `OVE_CHROMIUM_EXECUTABLE` picks a specific browser.

## Command line

```sh
npm install motionrender
npx motionrender init my-video                      # a code-first project: video.tsx, the agent instructions and skills
cd my-video && npm install --save-dev esbuild react react-dom && cd ..   # once: the build needs them
npx motionrender make my-video/video.tsx            # builds it, checks the design, draws one contact sheet (review.png)
npx motionrender render my-video/video.tsx --output out.mp4
```

For a video written as JSON instead, `npx motionrender init my-video --composition` creates a `composition.json`; preview it with `npx motionrender dev my-video/composition.json` and render it with `npx motionrender render my-video/composition.json --output out.mp4`.

You can use `motionrender`, `mr`, or `ove` interchangeably:
`npx motionrender` lists every command: `init`, `schema`, `doctor`, `browser install`, `dev` (live preview with audio), `render` (formats, codecs, transparency, frame ranges, batch rendering), `ai` and `ai studio` (`motionrender ai studio`).

## Node API

```js
import { loadCompositionFile, renderMedia, renderStill } from 'motionrender';

const { composition, baseDir } = await loadCompositionFile('my-video/composition.json', { title: 'Hello from Node' });

await renderMedia(composition, {
  baseDir,
  output: 'out/hello.webm',          // format follows the extension: .mp4 .webm .mov .gif, or no extension for PNG frames
  transparent: true,                 // webm, mov and png only
  frameRange: [0, 89],               // optional, inclusive
  onProgress: ({ rendered, total }) => console.log(`${rendered}/${total}`),
  signal: AbortSignal.timeout(60_000),
});

const png = await renderStill(composition, { baseDir, frame: 45 }); // a Buffer
```

## React Videos & Builder

```js
import { AbsoluteFill, Scene, Series, interpolate, spring, useCurrentFrame, useVideoConfig } from 'motionrender/react';
import { createVideo, text, rect, sample } from 'motionrender/builder';
```

`<Scene from={24} durationInFrames={32} fadeIn={6} fadeOut={6}>` fades its React visuals. Audio cues in adjacent sequences can reuse the same source. Give cues distinct `name` values if they reuse the same JSX position and sequence start.

`mr review composition.json --target web` uses web type sizing and omits social feed UI bands. The default target is `social`.

## Player (browser)

```js
import { createPlayer } from 'motionrender/player';
const player = await createPlayer(document.querySelector('#video'), { composition, assetBase: '/media/', controls: true });
```

Plays a composition live in any page with sound, drawn by the same code as the renderer. `play`, `pause`, `seek`, `setValues`, `destroy`, and `frame`/`play`/`pause`/`ended`/`error` events.

## Writing compositions

`mr init` creates a starter project with `composition.schema.json` for editor checks and an agent skill (`.claude/skills/ove/SKILL.md`) that documents the whole format for coding agents and people alike.

MIT licensed.
