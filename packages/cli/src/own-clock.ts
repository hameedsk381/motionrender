// A video is drawn one frame at a time from the frame number, so a library that animates on a clock of its own shows its first state in every frame, with no error.
// This names the ones in a bundle that are known (or likely) to do that, so the build can say so instead of leaving the video quietly still.

type Entry = { match: RegExp; name: string; fix: string };

const LIBRARIES: Entry[] = [
  { match: /^(framer-motion|motion|motion-dom)$/, name: 'framer-motion', fix: 'its animate and transition props never move in a frame-driven render (checked): set a useMotionValue from the frame (x.set(frame * 10)) or use springValue' },
  { match: /^(@react-spring\/.+|react-spring)$/, name: 'react-spring', fix: 'its springs run on a timer: use springValue({ frame, delay, preset }) instead' },
  { match: /^gsap$/, name: 'gsap', fix: 'its tweens run on a ticker: build a paused timeline and seek it from the frame (tl.seek(frame / fps))' },
  { match: /^(animejs|anime)$/, name: 'anime.js', fix: 'its animations run on a timer: create them paused and seek from the frame' },
  { match: /^react-transition-group$/, name: 'react-transition-group', fix: 'its transitions are timer-driven: derive the state from the frame' },
  { match: /^(lottie-react|lottie-web|react-lottie|@lottiefiles\/dotlottie-react)$/, name: 'a Lottie player', fix: 'it plays on its own clock: set its frame from useCurrentFrame() (goToAndStop) or use the lottie layer' },
];

/** Warnings for every self-clocked library among the bundle's input files (paths as esbuild's metafile lists them). A video that calls useTimeline() seeks its timelines from the frame, so GSAP and anime.js are not warned about. */
export function selfClockedLibraries(inputs: string[], source = ''): string[] {
  const seeks = /\buseTimeline\s*\(/.test(source);
  const found = new Set<string>();
  for (const input of inputs) {
    const names = [...input.replace(/\\/g, '/').matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)\//g)].map(match => match[1]!);
    const last = names[names.length - 1];
    if (last) for (const entry of LIBRARIES) if (entry.match.test(last)) found.add(entry.name);
  }
  return LIBRARIES.filter(entry => found.has(entry.name) && !(seeks && (entry.name === 'gsap' || entry.name === 'anime.js'))).map(entry => `Warning: ${entry.name} is in this video and may animate on a clock of its own, which a frame-driven render never advances; ${entry.fix}. See: mr guide libraries`);
}
