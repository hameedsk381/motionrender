---
name: ove-kinetic-type
description: Choreograph readable, frame-accurate kinetic typography and word-timed captions in MotionRender. Use for headlines, key statements, lyric-style emphasis, and caption-led social videos; do not use it to animate every body-text word.
---

# Kinetic typography

Movement must reinforce the words. Begin with a hierarchy: one primary statement, supporting copy, and captions if narration exists. Use `motion-design` before choosing pacing and easing.

## Pick the right timing source

- For spoken words, use `ove-voiceover-captions` and its word timings; the emphasis should follow the actual voice.
- For an unscripted headline, use a short explicit frame sequence. JSON text layers can use `split` by words, letters, or lines; React videos can use `KineticText`.

Use words for most statements, letters only for a very short hero word, and lines for a compact multi-line claim. Animate the entrance plus one subtle secondary motion; avoid cycling or bouncing text until it becomes hard to read.

## Maintain readability

Keep body text whole. Preserve enough still time to read each phrase, maintain contrast, and keep type clear of social safe zones. Pair opacity with position or scale for an important entrance, but do not make every element compete. Reuse one split style and stagger logic throughout a video.

## Verify

Inspect `mr still` frames during the first and last split item, and check the contact sheet from `mr make`. Watch a draft at normal speed: if the viewer has to replay to read the claim, simplify timing or reduce the number of animated units. Run `mr review` before final rendering.
