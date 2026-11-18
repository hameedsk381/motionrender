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

Run `mr plan direct "your brief" --react --format 9:16 --output explainer.json`, then `mr make explainer.json --no-voice`. The React director chooses a look and storyboards from the full explainer scene catalog. It fills each selected drawing separately using its schema and supported variants. The output uses explainer timing.

After building, `mr review composition.json --allow-code --clips-dir checkpoints --json` writes short silent MP4s around the planned moments and reports the scene and target frame for each. Only enable code for trusted compositions.

For a soundtrack revision, use `mr soundtrack original.mp4 --audio mix.wav --output revised.mp4`. The new audio replaces the whole audio track. For local primitive renders, `mr render composition.json --frame-cache .frames --cache-namespace my-renderer-v1` enables frame reuse. Change the namespace when fonts, browser or renderer versions change. React, asset-backed scenes and transitions bypass this cache.
