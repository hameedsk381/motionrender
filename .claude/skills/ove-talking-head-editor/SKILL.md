---
name: ove-talking-head-editor
description: Turn user-provided talking-head footage into an editable, captioned MotionRender short or reel. Use for interviews, tutorials, webinars, and creator clips; do not alter meaning or fabricate statements.
---

# Talking-head editing

The speaker and their meaning are primary. Preserve the intended statement, identify every source clip, and obtain approval before removing material that could change context.

## Build an editable project

Start with the supplied recording:

```sh
mr ai edit input.mp4 --out reel-dir --max-silence 0.5
```

For a longer recording with several possible clips, use:

```sh
mr ai shorts recording.mp4 --out shorts-dir --count 3 --min 15 --max 60
```

These commands transcribe speech, remove routine pauses and fillers, create captions by default, and leave an editable project. Review the transcript and cuts before embellishing them. Use `--keep-fillers` when a speaker's natural voice matters, and `--no-captions` only when captions are intentionally deferred.

## Edit with purpose

Cut only for pace, clarity, errors, or a stated duration. Use B-roll, punch-ins, and overlays to clarify the spoken point; never use them to imply something the speaker did not say. Keep captions synchronized with the audio and out of platform safe zones.

When visual polish needs a richer layout, add a React scene or composition layer after the base edit. Keep original footage, transcript, and edit decisions together so another editor can audit them.

## Verify

Read the rendered transcript once, then run `mr review` and inspect the contact sheet. Render a draft and watch it at normal speed for caption timing, jump-cut rhythm, subject framing, and audio continuity before final output.
