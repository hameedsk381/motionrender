---
name: ove-reference-video-analysis
description: Analyze a user-provided reference video or edit to extract reusable pacing, shot, caption, color, and sound-direction decisions before making a MotionRender video. Use for reference-led work; do not download or reuse media without permission.
---

# Reference-led video direction

Use a reference to understand its *decisions*, not to copy its footage, brand assets, script, or distinctive visual identity. Begin by confirming that the user supplied the video or has permission to analyze it.

## Produce a direction brief before composing

Watch the complete reference and make a compact beat sheet. Record only observable, reusable choices:

- aspect ratio, duration, approximate cuts, and the first three-second hook;
- scene purpose, focal object, text density, transition, and motion energy per beat;
- typography hierarchy, color relationships, caption placement, and safe-zone treatment;
- narration cadence, music role, sound effects, and where silence creates emphasis.

Save the brief as `reference-direction.md` beside the new project. Do not reconstruct the reference shot-for-shot. Translate the brief to the user's subject, assets, palette, and claims.

## Choose the route

- For a supplied talking-head or raw clip, start with `mr ai edit input.mp4 --out reel-dir` or `mr ai shorts long.mp4 --out shorts-dir`; these create an editable project from speech timings.
- For a new motion-graphics treatment, create `video.tsx` or a composition based on the direction brief. Use `ove-react-video` for bespoke layouts and `ove-make-reel` for a block-based social treatment.
- For a video that teaches one idea, use `ove-explainer`; apply the reference's pacing and visual hierarchy, not its copy.

## Verification

Run `mr make` for the chosen source, open its contact sheet, then compare the rendered video against the brief: hook timing, readable text, pacing, and the user's original message must hold. Run `mr review` before final rendering. List any reference decisions deliberately not carried over.
