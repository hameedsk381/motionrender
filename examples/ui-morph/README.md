# One Shape

A 14-second square interface loop at 120 BPM. The same SVG shell carries eleven states from Start to export confirmation and back. All visual state comes from `window.seek(seconds)` in `index.html`. Open the HTML in a browser and call `seek(8.4)` in the developer console to scrub directly to any moment.

With workspace dependencies installed, Chrome and FFmpeg available, run from the repository root:

```sh
node examples/ui-morph/render.mjs --review
node examples/ui-morph/render.mjs
node examples/ui-morph/render.mjs --settings
```

The first command checks the loop boundary and writes 28 beat stills and a contact sheet. The second also synthesizes the original score, aligns UI audio cues by sample peak, captures four samples per frame and blends them in FFmpeg to produce a 1440 × 1440 MP4 at 60 fps. The known beat grid comes directly from the synthesized track. Set `OVE_CHROMIUM_EXECUTABLE` to use a different Chromium installation. Typography prefers locally installed Geist and falls back to Segoe UI and the browser's sans-serif.

The third command renders a variant with a shorter scrub and a Settings selection in place of Activity. Preview it with `index.html?recipe=settings`. Both variants use the same `dragValue` evaluator and persistent indicator, and the render script checks the release position, selected tab and loop boundary before encoding. To adapt the choreography, edit the cursor keyframes, grab and release beats, and tab destination in the HTML.
