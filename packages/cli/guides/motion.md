# motion: nothing sits still, nothing flashes

- **One personality per video.** Pick calm (smooth, gentle springs), punchy (snappy, bouncy) or editorial (slow fades, slides), and keep to it. The `motion-design` skill has the tables.
- **Springs, not linear moves.** `springValue({ frame, delay, preset })` with `smooth`, `gentle`, `snappy` or `bouncy`. Entrances take about 12 to 24 frames at 30 fps.
- **Stagger.** Items in a group arrive 8 to 14 frames apart, in the order they are read; never all at once.
- **Secondary motion.** After an entrance, give the scene a slow drift (a 1.04 scale over the scene, a float of a few pixels) so a hold never looks frozen. The review flags a picture that does not change for about 4 seconds.
- **Draw on, count up.** A line draws with `pathLength={1}` and `strokeDashoffset`; a number counts with `NumberTicker`. Both show change without moving the layout.
- **Cuts have a reason.** In a JSON composition, `transitionIn` takes fade, slide, wipe, zoom, iris, push, dip, blur or `whip` (a fast push smeared by a blur that peaks mid-move: use it when the energy should jump, 8 to 14 frames).
- **Cut to the content.** Scene length follows the beat of the story (or the spoken line), not a fixed number of seconds.
- **No flashing.** Avoid letter-by-letter typing and per-word flicker on text people have to read.
- **Pure in the frame.** Every value is a function of `useCurrentFrame()`: no `useState`, timers or `Math.random()` (use `random('seed')`).
- **Sound follows the picture.** A pop as each item lands, a whoosh on a move, a thump on the final number; each in a `<Sequence>` long enough to play it.
