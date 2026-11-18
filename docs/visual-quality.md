# Review evidence and creative quality

MotionRender review results are technical evidence. They are not aesthetic approval.

## Design handoff

Plans may carry `design`: concept, visualMetaphor, motif, typography (display/body/treatment), motion, avoid, and narrative acts. Each act names its purpose, beatIds, field, ink, optional surface and accent. Every beat must belong to exactly one act; act IDs must be unique. Scene backgrounds and primitive inks follow the act, and custom React modules receive the full handoff as `props.design`. The concept/motif/motion descriptions remain guidance for scene authors, not executable instructions. This does not replace the current constrained director's fixed scene structure. Markdown plans preserve the handoff in their front matter.

## Composition inspection

`reviewComposition()` returns `scope: composition-technical` and `creativeQuality: unassessed`. Native text and mounted live React DOM text contribute measurements for size, position, reading time, overlap, and clipping. React text is measured before rasterization and transformed into composition coordinates. For opaque text over a known solid DOM background, contrast is measured; gradients, images, filters and unknown backgrounds remain unassessed. Fully covering positioned opaque siblings with an explicit higher z-index are marked occluded and excluded from readability checks. Complex stacking, partial occlusion and exact transformed glyph sizes are not fully modeled. Non-DOM drawing inside canvas/WebGL and static-only React markup still need a separate inspection strategy; the inspector does not OCR pixels.

## Encoded deliverable

`reviewRenderedVideo(file, { requireAudio, expectedDurationSeconds })` probes the actual file and detects nearly black intervals and nearly unchanged pixels held for at least three seconds. These intervals are warnings because intentional black scenes and closing holds are legitimate. Missing expected audio and duration mismatches are errors. A uniform bright blank scene is not covered by black detection. The audit reports technical scope and leaves creative quality unassessed.

## Art-director approval

A usable vision critique must describe every supplied frame exactly once, with the requested labels. Approval requires an explicit `ready: true`, score of at least eight, and no unresolved findings. An unavailable critic remains unavailable rather than supplying evidence of quality. The optional agent critique loop does not yet enforce a creative release gate. Model scores still need calibration against blind human ratings.

## Remaining adoption work

- Pixel-based contrast, complex occlusion and coverage reporting for rasterized content.
- Generate and apply subject-specific design handoffs through the director and Studio; replace the constrained director's fixed roles.
- Temporal creative review of clips rather than settled stills alone.
- Repetition checks across outputs and human-calibrated aesthetic evaluation.
- Wire encoded and creative release gates into all CLI, MCP, and Studio delivery paths.

The implementation uses MotionRender's own runtime and dependencies. No third-party toolkit code has been copied in this stage.
