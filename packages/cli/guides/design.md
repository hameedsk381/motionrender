# design: colour and finish the way a designer works

A video that looks generic is almost never short of animation. It is short of decisions: three unrelated bright hues, pure black behind pure white, flat fills, grey shadows, glass cards on every screen. Colour is the fastest way to fix that, and it is a system, not a list of hex codes.

## Start from a palette, never from memory

```tsx
import { Backdrop, palette } from 'motionrender/react';
const p = palette('obsidian-ember');                       // or palette({ brand: '#2f5bff', accent: '#ffb020', mode: 'dark' })
<Backdrop palette={p} />                                     // the ground, first in the video
```

`mr palette` lists twelve presets (a mood, a ground, one brand, one accent); `mr palette <name>` prints every token with its contrast; `mr palette --brand "#hex"` builds one from the customer's colour. Pick by the subject, not by taste: finance and data want a deep blue with one warm signal; a launch wants a warm near-black with one hot colour; an explainer wants warm paper with ink and one accent; wellbeing wants deep green or sage.

Take every colour from `p`: `p.bg`, `p.surface`, `p.surfaceRaised`, `p.border`, `p.text`, `p.textMuted`, `p.accent`, `p.onAccent`, `p.brand`, `p.secondary`, `p.ramps.brand[500]`. No raw hex in a component. Do not default to indigo, purple and pink: that is the look every generated video shares.

## The rules a designer would hold you to

1. **One brand, one accent.** Two hues carry the whole video. A third (`p.secondary`) is for data series only. More than three hues in a frame reads as unplanned.
2. **60 / 30 / 10.** About 60% ground and surfaces, 30% text and neutrals, 10% accent. The accent belongs to the one thing the scene is about (the number, the verb, the button); if everything is the accent, nothing is.
3. **Never pure black or pure white.** A dark ground sits near lightness 16%, tinted with the brand hue; text is a tinted off-white; a light ground is warm paper, not `#fff`. `p.bg` and `p.text` already are.
4. **Neutrals lean toward the brand.** Grey with a little colour in it is what separates designed surfaces from default ones. Use `p.ramps.neutral`, not `#888`.
5. **Depth by lightness, not by outline.** On dark: ground, then `surface`, then `surfaceRaised`, each a step lighter; add a 1 px `p.border`. Shadows carry the ground's hue: `shadow(p.bg, 3)`. A glow belongs to the accent only: `glow(p.accent)`.
6. **Gradients pass through colour.** `gradient(a, b)` mixes in OKLCH, so the middle is a real colour and not grey. Keep the shift small (about 30 degrees of hue, 10 to 20% of lightness). Never a rainbow, never purple into pink by default.
7. **Contrast is the floor.** Body text 4.5:1 or more on its ground (`p.text` is 7:1+), large text 3:1, text on the accent is `p.onAccent`. `textFaint` is for large or decorative text only.
8. **Keep saturation honest.** Large areas stay at moderate chroma; the vivid colour is small and bright. Thin, saturated text (red or orange on dark) smears in H.264 chroma subsampling: make it larger or move it to `p.text`.
9. **Give a dark gradient some grain.** Smooth dark gradients band in the encoder. `<Backdrop>` adds a fine static grain for this; keep it on.
10. **Type earns the same care.** Two families at most, one for display and one for text; pick weights deliberately (display 600 to 800, text 400 to 500) and keep the sizes on the scale in `mr guide floor`.

## A frame, in one sentence each

- The ground: `<Backdrop palette={p} />`.
- A card: `background: p.surface`, `border: '1px solid ' + p.border`, `boxShadow: shadow(p.bg, 2)`, `borderRadius: 24`.
- The hero number: `color: p.accent`, `textShadow` none, set large; the label under it `p.textMuted`.
- A button or chip: `background: p.accent`, `color: p.onAccent`; its hover or emphasis state `p.accentStrong`.
- A chart: the series in `p.accent` first, `p.brand` second, `p.secondary` third, grid lines `p.border`.
- A highlight: `p.accentSoft` behind text, never a second bright colour.

## What the review checks

`mr make` flags pure black or pure white text and ground, more than three hues in the text colours, and a frame that is one flat colour with no depth. It cannot judge taste: look at the contact sheet and ask whether one thing in each frame is clearly the accent, and whether the ground has any depth at all.
