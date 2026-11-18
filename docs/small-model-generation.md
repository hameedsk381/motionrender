# Constrained video generation

Use `mr plan direct "Explain how a shared inbox routes requests" --constrained --duration 15 --output video.md`, then `mr make video.md --draft`.

The constrained path supports a three-beat product explainer: hook, workflow or before/after, and call to action. Each call produces only one typed scene input. Failed calls retry that scene with validation feedback, with a bounded attempt limit. The application owns IDs, layout, motion, transitions, and reading-time budgets. Inputs survive Markdown round trips using `Scene-input:` JSON records.

Contracts bound headline length and require exactly three short workflow labels or two contrast labels. Extra properties, executable code fields, and scene/input mismatches fail validation. The compiler consumes the labels directly rather than interpreting prose to reconstruct a diagram.

This improves structural reliability; it does not establish factual accuracy, visual quality, or adherence for a particular model. Do not infer a measured small-model success rate from fixture tests. The current path omits factual proof scenes, narration generation, media selection, and arbitrary custom scenes.

## Evaluation

Run product workflow, customer support, appointment booking, document review, and team onboarding briefs against each named model. Keep prompts, model versions, provider settings and output dimensions fixed. Record per-beat attempts, schema failures, duration failures, compile failures, visual review findings, and human ratings of brief adherence. Include malformed outputs and overly long copy in regression tests. A model passes only when its rendered results meet the agreed quality threshold; JSON validity alone is insufficient.
