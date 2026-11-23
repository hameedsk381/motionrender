# libraries: use them, but the frame is the clock

A video is drawn one frame at a time from the frame number. Any npm package is bundled into the video (`import { line } from 'd3-shape'` just works), but a library only behaves if it takes its time from `useCurrentFrame()` instead of from a clock of its own.

## What was tried (MotionRender 0.12.3, real packages, a still at two or three frames each)

| Library | Result | How to use it |
|---|---|---|
| `d3-shape`, other pure d3 modules | Works fully | Compute the path or scale in the component, drive the draw-on from the frame |
| `recharts` 3 | Works with its own animation off | Pass `isAnimationActive={false}` to every series and reveal the data from the frame (`data.slice(0, n)`) |
| `framer-motion` 14 | Its own `animate` / `transition` never moves: no error, no warning in the picture | Use `useMotionValue` and set it from the frame (`x.set(frame * 10)`), or skip it and use `springValue` |
| `gsap` 3 | Works through `useTimeline` | `const s = useTimeline({ x: 0, r: 0 }, s => gsap.timeline({ paused: true }).to(s, { x: 900, duration: 2 }))` (from `motionrender/react`) seeks the timeline to the frame; read `s.x`, `s.r` |
| `lucide-react` | Works fully | Pictures for scenes: `<Rocket size={240} strokeWidth={1.5} />`; animate the wrapper with `springValue` |
| `@dicebear/core` + `@dicebear/collection` | Works (seeded, so the same seed is the same face every render) | Install the two at the same major version (`@dicebear/core@9` with `@dicebear/collection@9`: the latest core and collection did not match); `createAvatar(style, { seed }).toString()` into `dangerouslySetInnerHTML` |
| `@react-three/fiber` 9 + `three` | A plain `<Canvas>` drew nothing; works through `ThreeCanvas` | `import { ThreeCanvas, useThreeTime } from 'motionrender/three'` (install `@react-three/fiber` and `three` next to the video). `<ThreeCanvas camera={...}>` fills its box, draws once per frame and holds the frame until it is drawn; `useThreeTime()` gives `{ frame, seconds }` inside it, and `useFrame`'s clock is set to the same time |
| `shiki` 4 | Works | `codeToHtml` is async: `delayRender()` before, `continueRender()` when the HTML is in state; a themed block uses many colours, so expect the review's text-colour warning |
| `katex` | Works | `katex.renderToString(String.raw\`...\`, { displayMode: true })` and import `katex/dist/katex.min.css`. Older builds of `mr make` report its hidden screen-reader copy as clipped text; that report is wrong |

Not tried yet, so do not assume: lottie-react, react-spring, anime.js, Mermaid, CSS `@keyframes`. Render one still at two frames (`mr still video.tsx --frame 10`, then `--frame 60`) before building a scene on one of them.

## Rules

1. **One copy of React.** Do not `npm install react` inside the folder that holds the video if a parent folder already has it: two copies end in `Cannot read properties of null (reading 'useContext')`. Remove the inner `react`, `react-dom` and `scheduler` (with npm, install peers with `--legacy-peer-deps`).
2. **Pure is safe.** Math, colour, scale, path, geometry and formatting libraries (d3 modules, chroma-js, culori, date-fns with a fixed date) are fine. `Date.now()` and `Math.random()` are not repeatable: use `random('seed')` and compute dates from `frame / fps`.
3. **Own animation is off or sought.** A library that animates by itself (timers, `requestAnimationFrame`, transitions) shows its first state in every frame. Turn the animation off and give it the state for this frame, or, if it has a timeline, seek the timeline from the frame.
4. **Async work waits.** Loading data, fonts, a highlighter or a canvas that is not ready on first render: `const handle = delayRender('label')`, then `continueRender(handle)` when it is ready. The frame is drawn once every handle is released.
5. **Check the picture, not the build.** A video that builds and passes the review can still have a library that never moved. `mr make` warns when the bundle contains a library known to animate on its own clock; for anything else, compare two stills.
