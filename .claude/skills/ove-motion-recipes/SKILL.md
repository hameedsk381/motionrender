---
name: ove-motion-recipes
description: Choose a MotionRender production workflow from an indexed catalog of motion techniques, including launch videos, animated charts, UI morphs, explainers, lower thirds, maps, and audio-driven graphics.
---

# Motion recipes

Use the [catalog](references/iart-catalog.md) to match the brief to a technique. Read the linked upstream entrypoint when a technique needs implementation detail. The catalog credits iArt's MIT-licensed motion skill collection.

- For original MotionRender work, choose the native authoring route from the catalog. Translate external renderer examples into frame-driven MotionRender layers or React. An external tool can supply a media asset when the brief requires it.
- Establish the deliverable, aspect ratio, assets, and beat or narration timing. Select the shots and review criteria before building.
- Use `mr still`, `mr make`, or `mr review` as appropriate for the input. Inspect the real text, data, and assets in the draft. Sample handoffs as well as held poses. Use the motion-design seam checks for loops and sample the same frame out of sequence for stateful-looking effects.
- Export with `mr render` after review. Verify the requested dimensions, frame rate, duration, and streams with FFprobe. If an export mode needs a separate tool, verify it with a short sample before committing to a full render.
