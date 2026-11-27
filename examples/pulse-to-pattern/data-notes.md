# From Pulse to Pattern

`samples.json` contains 24 synthetic amplitude samples in arbitrary units. They illustrate a geometric transformation and make no claims about a measured signal. For each sample the crest offset, bar height, and radial bar length are the same value multiplied by 3.1 pixels. The order is preserved as the baseline bends around the circle.

Run `node examples/pulse-to-pattern/score.mjs` to regenerate the original 120 BPM score. The 2s, 6s, and 10s downbeats accent the split, wrap, and unwind. Render `video.tsx` through MotionRender's React workflow.
