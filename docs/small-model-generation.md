# Constrained video generation

Use `mr plan direct "Explain how a shared inbox routes requests" --constrained --duration 15 --output video.md`, then `mr make video.md --draft`.

The CLI constrained path now calls `directDesignedVideo`: it first generates a design handoff and 2–6 beats with chosen IDs, purposes and scene kinds. The handoff maps every beat to a narrative act. Scene inputs are then produced independently with validation and bounded retries. Layout remains limited to the implemented primitives; a creative concept is not automatically realized merely because it appears in the handoff. Inputs survive Markdown round trips using `Scene-input:` JSON records. The lower-level `directConstrainedVideo` remains available for supplied stories and legacy three-beat callers.

Pass `--avoid previous-video.md` (repeat the option or use comma-separated paths) to provide previous directions. A scene-sequence similarity warning catches palette/copy-only variants. It is a structural signal, not a visual or aesthetic score. Studio's semantic plan workspace can edit design concepts, motifs, typography and narrative acts.

Contracts bound headline length and require exactly three short workflow labels or two contrast labels. Extra properties, executable code fields, and scene/input mismatches fail validation. The compiler consumes the labels directly rather than interpreting prose to reconstruct a diagram.

This improves structural reliability; it does not establish factual accuracy, visual quality, or adherence for a particular model. Do not infer a measured small-model success rate from fixture tests. The current path omits factual proof scenes, narration generation, media selection, and arbitrary custom scenes.

## Evaluation

Run product workflow, customer support, appointment booking, document review, and team onboarding briefs against each named model. Keep prompts, model versions, provider settings and output dimensions fixed. Record per-beat attempts, schema failures, duration failures, compile failures, visual review findings, and human ratings of brief adherence. Include malformed outputs and overly long copy in regression tests. A model passes only when its rendered results meet the agreed quality threshold; JSON validity alone is insufficient.
