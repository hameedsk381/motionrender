# Composition and choreography

Typed scene inputs accept optional `layout` and `choreography` fields. Design-first generation requires both; legacy inputs without them retain their existing rendering path.

| Scene | Layout choices |
|---|---|
| kinetic-hook | editorial, poster, split |
| workflow | horizontal, vertical, radial, branch (one source to two outcomes) |
| before-after | split, stacked |
| decisive-cta | centered, corner, banner |

Choreography choices: `reveal` introduces content together; `cascade` staggers entrances within a bounded budget; `trace` grows horizontal connection/rule shapes while introducing related text. The compiler owns timing, typography sizing and positions. These are finite arrangements, not arbitrary visual invention or a guarantee that a creative metaphor is realized. Current controlled renders validate landscape use; portrait compositions need their own visual acceptance checks.

`comparePlanVariety` now includes layout and choreography in structural sequences. `compareRenderedVariety` samples actual engine-rendered frames, reports grayscale pixel agreement and edge overlap, and returns `likely-repeated`, `different-samples`, or `inconclusive`. It does not decode MP4 files. Edge overlap drives the repetition verdict so background colours do not dominate classification. Low-information frames produce insufficient evidence. Sampling aligns normalized playback time; it is not a full temporal/perceptual metric. Thresholds require calibration and are not aesthetic scores.

## Reproduce the controlled comparison

Run `tsx scripts/compare-scene-arrangements.ts`. This renders four nine-second videos with identical FOSS Andhra copy, three actual spatial arrangements and one palette-only control. It saves plans, compositions, contact sheets, MP4 files and report.json beneath artifacts/composition-variety. `--compare-only` compares existing saved plans without rendering the MP4 files again.

Observed seven-frame sample results against the editorial version:

| Comparison | Edge overlap | Raw pixel agreement | Verdict |
|---|---:|---:|---|
| Identical control | 1.00 | 1.00 | likely repeated |
| Poster / vertical / banner | 0.19 | 0.95 | different samples |
| Split / radial / centered | 0.05 | 0.96 | different samples |
| Palette-only control | 0.97 | 0.16 | likely repeated |

These controls show sensitivity to the intended differences in this sample. They do not establish general creative diversity. Regression tests also cover palette inversion, moved content, and blank-vs-blank comparisons. The example copy is fixed deliberately: no model calls are involved in the controlled experiment.

## Directing with React drawings

Run `mr plan direct "your brief" --react --format 9:16 --output explainer.json`, then `mr make explainer.json --no-voice`. The React director extracts ordered routes, simultaneous branches, and open-to-closed folds before it chooses a look and scenes. Each extracted action must appear once and in order. The compiler uses the extracted path labels and fold titles, while the director supplies drawing choices such as branch directions and fold artwork. Supply a file path in the brief to use a media scene. An explicitly silent brief produces a script with `silent: true`, which suppresses narration, music, and sound effects during the build. The output uses explainer timing.

After building, `mr review composition.json --allow-code --clips-dir checkpoints --json` writes short silent MP4s around the planned moments and reports the scene and target frame for each. Only enable code for trusted compositions.

The React plan command checks named media files relative to the script output directory. If a file is missing, the director chooses from the drawings and media still available. Invalid scene replies get a correction with the field paths and the original drawing contract. The director also checks common measurable claims, numeric chart values, and exact quotations against the brief. Provide the figures and source text you want to use in the video.

For a soundtrack revision, use `mr soundtrack original.mp4 --audio mix.wav --output revised.mp4`. The new audio replaces the whole audio track. For local primitive renders, `mr render composition.json --frame-cache .frames --cache-namespace my-renderer-v1` enables frame reuse. Change the namespace when fonts, browser or renderer versions change. React, asset-backed scenes and transitions bypass this cache.

A `route` scene keeps station labels fixed while a traveler visits the stops listed for each trip. Its trace clears at the start of the next trip. In React explainer JSON, use this scene shape:

```json
{
  "kind": "route",
  "stops": ["Depot", "Sorting hub", "Home"],
  "trips": [
    {"name": "Standard", "via": ["Depot", "Sorting hub", "Home"]},
    {"name": "Local", "via": ["Depot", "Home"]}
  ],
  "cue": {"name": "Delivered locally", "trip": "Local", "stop": "Home"}
}
```

With a storyboard, review anchors its decisive frame at that arrival. To select a repeated stop, specify its one-based visit in the trip. An optional `save` event uses the same reference with a `label` that stays visible at the stop. Semantic plans use the same data in `visual.input`, with `type: "route"`, a headline and `visual.scene: "route"`.

For simultaneous distribution, choose `split`. Give it one origin and exactly two named endpoints with distinct directions. Both travelers start together and leave visible traces. A storyboard review samples their arrival. Example React scene:

```json
{"kind":"split","origin":"Depot","branches":[{"endpoint":"West district","direction":"left"},{"endpoint":"East district","direction":"right"}]}
```

Directions are `left`, `right`, `down`, `down-left` and `down-right`. Semantic plans use the same fields in a `split` scene input with a headline.

Use `fold` for a physical, two-panel sheet. Set `inside` and `cover` to the printed titles, `artwork` to `print` or `map`, and `direction` to `right-to-left` or `left-to-right`. The moving panel turns edge-on at the crease, then reveals its reverse face. The storyboard checkpoint follows the frame where the cover closes. Semantic scene inputs use layout `sheet` and choreography `hinge`.

Both explainer and semantic scene inputs accept an optional `variant` for these actions.

| Action | Default | Alternative |
|---|---|---|
| Route | `map` positions the stops around a network | `rail` aligns them in station order and carries a bypass above the unvisited stops |
| Split | `fork` traces straight rays from the origin | `manifold` shares an inlet and uses right-angle branches, with both endpoints reached together |
| Fold | `sheet` turns continuously over a tall page | `booklet` uses a wide cover and briefly holds at the crease |

## Authoring in Markdown

Write a `video.md` with a heading for each beat and labelled lines for anything the compiler needs to draw. The default `mr plan direct "your brief" --output video.md` asks the configured model to write this format. You can also write the same file by hand and run `mr make video.md --draft` without a model.

```markdown
---
title: Two trains
format: 9:16
---

# The express skips Market
Duration: 6s
Scene: route
Variant: rail
Trip: Local | Central → Market → Harbor
Trip: Express | Central → Harbor
Arrival: Express arrival | Express → Harbor
```

- A route infers its stops from the trips. Add an optional `Stops: Central → Market → Harbor` to specify their display order. `Arrival:` and `Save:` accept a stop name or a one-based visit such as `#3` after the trip name. Without an arrival line the cue uses the final visit of the last trip.
- A split uses `Origin:` and two `Branch: name | direction` lines. A fold uses `Inside:` and `Cover:`. Its optional `Artwork:` and `Direction:` default to `print` and `right-to-left`.
- A workflow uses three `Step:` lines. A before-and-after scene uses `Before:` and `After:`. A kinetic hook or CTA can use `On-screen:` for its copy.
- For a custom visual, build a trusted component with `mr build scene.tsx --output scene.preview.json`. Add `> React [hero]: ./scene.bundle.js` to the Markdown, then `Module: hero` under the relevant beat. The component receives the beat and its timing. Run `mr make video.md --allow-code --draft` to review and render it.

The build produces `composition.json` for validation, review and rendering. Existing plans that use `Scene-input:` still load.
