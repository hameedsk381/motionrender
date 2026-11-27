---
name: ove-data-visualization
description: Create accurate MotionRender data-explainer videos from supplied CSV or JSON and cited facts. Use for charts, comparisons, maps, metrics, and narrated quantitative stories; do not invent, round, or visually distort data.
---

# Data visualization videos

Data determines the story, scale, and chart form. Establish the source of truth before choosing a visual treatment.

## Prepare the dataset

Keep a local CSV or JSON file with source URL, retrieval date, unit, geography, time range, and any transformation. Use `mr facts` for supported World Bank, Wikipedia, and exchange-rate lookups; otherwise use user-supplied data. Never turn an unsupported claim into a visual fact.

Choose the display by question:

- change over time → line, area, or timeline;
- comparison → ranked bars or two-sided comparison;
- composition → stacked bars or a labeled ring only when parts sum to a whole;
- route or geography → map or route sequence;
- one consequential number → a single giant statistic with context.

Start axes at zero for magnitude comparisons unless the non-zero baseline is stated prominently. Preserve labels, units, uncertainty, and source attribution.

## Build

For a fully custom chart, use `ove-react-video` and pass parsed, local data into the component. For a structured treatment, use a composition or `ove-explainer` with sourced `stat`, `chart`, and `timeline` scenes. Keep every frame a pure function of the data and frame number; do not fetch changing data during render.

Write a `data-notes.md` beside the project containing the input file, transformations, source, date, and claims used in narration.

## Check

Validate source values against the input after writing copy. Use `mr make` and inspect the contact sheet for clipped labels, misleading scale changes, color-only distinctions, and unreadable legends. Run `mr review`, then render a draft and final only after the numeric and visual checks agree.
