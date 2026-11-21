# motion: nothing sits still, nothing flashes

- **One personality per video.** Pick calm (smooth, gentle springs), punchy (snappy, bouncy) or editorial (slow fades, slides), and keep to it. The `motion-design` skill has the tables.
- **Springs, not linear moves.** `springValue({ frame, delay, preset })` with `smooth`, `gentle`, `snappy` or `bouncy`. Entrances take about 12 to 24 frames at 30 fps.
- **Stagger.** Items in a group arrive 8 to 14 frames apart, in the order they are read; never all at once.
- **Secondary motion.** After an entrance, give the scene a slow drift (a 1.04 scale over the scene, a float of a few pixels) so a hold never looks frozen. The review flags a picture that does not change for about 4 seconds.
- **Draw on, count up.** A line draws with `pathLength={1}`, `strokeDasharray="1 1.2"` and `strokeDashoffset={1.1 * (1 - draw)}` (the gap must be longer than the path: with an equal gap a round cap can paint a dot where the line starts, and the review warns `svg-round-cap-dot`); a number counts with `NumberTicker`. Both show change without moving the layout.
- **Cuts have a reason.** In a JSON composition, `transitionIn` takes fade, slide, wipe, zoom, iris, push, dip, blur or `whip` (a fast push smeared by a blur that peaks mid-move: use it when the energy should jump, 8 to 14 frames).
- **Cut to the content.** Scene length follows the beat of the story (or the spoken line), not a fixed number of seconds.
- **No flashing.** Avoid letter-by-letter typing and per-word flicker on text people have to read.
- **Pure in the frame.** Every value is a function of `useCurrentFrame()`: no `useState`, timers or `Math.random()` (use `random('seed')`).
- **Declare what must be true of the motion.** Put a `video.motion.json` beside the video (`explainer.motion.json`, `composition.motion.json`); `mr make` and `mr review` check it on the real frames and fail each broken line:

```json
{ "assertions": [
  { "appearsBy":    { "text": "Solar got cheap", "seconds": 1 } },
  { "before":       { "first": "Hand-built", "then": "Factories scale" } },
  { "staysInFrame": { "text": "Mass production" } },
  { "keepsMoving":  { "from": 1, "to": 12, "every": 2 } }
] }
```

  `appearsBy`: the text is in view (opaque, uncovered, inside the frame) by that second (or `frame`). `before`: one text is in view before another. `staysInFrame`: from when it appears, the text never leaves the frame (`to` ends the check at a time). `keepsMoving`: the picture never stands still for longer than `every` seconds (default 2) between `from` and `to`. Text is found by what it says, a part of it in any case. Write them while you plan the video: they are the brief for the motion, and they catch a title that comes in late or a card that slides off the edge.
- **Sound follows the picture.** A pop as each item lands, a whoosh on a move, a thump on the final number; each in a `<Sequence>` long enough to play it.
