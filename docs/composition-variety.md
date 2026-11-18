# Composition and choreography

Typed scene inputs accept optional `layout` and `choreography` fields. Design-first generation requires both; legacy inputs without them retain their existing rendering path.

| Scene | Layout choices |
|---|---|
| kinetic-hook | editorial, poster, split |
| workflow | horizontal, vertical, radial |
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
