---
name: ove-sound-design
description: Design and verify narration, music, sound effects, ducking, and loudness for a MotionRender video. Use when audio needs intentional timing or mix quality, not merely an exported soundtrack.
---

# Sound design and mix

Use only audio the user supplied, owns, or is licensed to use. Treat narration intelligibility as more important than music and effects.

## Establish the audio plan

Identify narration, music bed, transitions, and emphasis moments before assigning sounds. Place effects at semantic events—a reveal, completed action, or transition—not on every animation. Prefer silence when it improves the next spoken or visual beat.

For narration and word timing, read `ove-voiceover-captions`. Add audio in the source video with explicit start/end frames, fades, and volume. Keep the music bed lower than narration; do not assume a fixed level works for every recording.

Set `export.loudness` deliberately: `-16` LUFS is a useful general target, while `-14` suits many vertical social deliveries. Preserve the user's requested delivery spec if it differs.

## Check the mix

Run `mr review composition.json --output review.png`; it reports problematic loudness, clipping, and sounds cut off by scene boundaries. Render a draft and listen on headphones and laptop speakers. Check that dialogue stays intelligible, effect timing matches frames, fades are clean, and silence is intentional.

Use `mr soundtrack video.mp4 --audio revised.wav --output revised.mp4` only when replacing a completed soundtrack with a separately approved mix. It is not a substitute for checking sync and loudness.
