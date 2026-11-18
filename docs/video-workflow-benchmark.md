# Video workflow benchmark

Run the same briefs through MotionRender, Claude + Remotion, and Claude + HyperFrames. Record the exact model, framework version, machine, prompt, reference assets, and human interventions. Do not compare framework speed using different resolution, duration, or encoding settings.

## Briefs

1. A 15-second product launch: problem, three connected workflow steps, one call to action. 1920×1080, 30 fps, no stock media.
2. A 20-second vertical explainer with one sourced statistic, a process diagram, narration and timed captions. Supply the same source quote and audio to each workflow.
3. A 10-second visual match to supplied reference footage. Preserve pacing and layout while replacing copy and brand colours.
4. Revise brief 1: change the middle scene's headline and motion while preserving the opening and close.

## Measurements

Record elapsed authoring time, render time, failed attempts, intervention count, changed files, and output correctness. Have reviewers score legibility, pacing, visual coherence, and brief adherence blind to the framework. Verify determinism by rendering the same frames twice and comparing pixels. Measure incremental render time for brief 4 with both cold and warm caches.

## Results

No competitive results have been collected. A successful local MotionRender custom React scene build and two-second render is a smoke test, not a comparative quality result. Competitor runs require the respective framework installations and a configured coding-agent session.
