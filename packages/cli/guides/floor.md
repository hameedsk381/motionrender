# floor: what `mr make` holds every video to

Write to these from the first line; the design review and the finished-file check list anything under them.

**Type (a 1080 px wide frame; scale with the frame)**
- Labels 24 px or more (under 20 px is flagged). Body text 26 px or more.
- Large type needs `lineHeight` 1.2 or more, or lines overlap.
- One type scale of 5 to 8 sizes. Near-equal sizes (176 and 188) are flagged.
- About 40 words or fewer on screen, and no more than two or three headline-size texts at once.
- Contrast 3:1 or more for large text, 4.5:1 for small.

**Frame**
- In a 9:16 video keep text out of the top 8%, the bottom 18% and the right 11%: the platform's buttons cover them.
- Use the room: a picture that fills under half of the usable height in most frames is noted as empty.
- Nothing runs off the frame or is clipped by its container.
- Frame 0 is the thumbnail in many feeds and players: have the hero (title, picture or number) already in view on the first frame, and let the motion start from there. A first frame that is only the background is noted.

**Pictures**
- A picture or clip must be declared in `config.assets` and used by its id. An undeclared one renders as nothing and is an error (`image-missing`); a declared file that is not in the project fails the build.

**Motion**
- Nothing may stay still for long: about 4 s (6 s on a closing hold) of an unchanged picture is flagged.
- Text that types or animates letter by letter reads as flashing text.

**Sound**
- Set `export.loudness` in `config` (-16, or -14 for vertical social video).
- Every `sfx:` sound needs a `<Sequence>` long enough to play it.
- With a voice, keep the music bed near volume 0.25.

**The finished file** (after `mr make --draft` or `--final`): the size and length it was set to, sound present and not silent, loudness within 3 LUFS of the target, no black stretch, no picture frozen for most of the video.
