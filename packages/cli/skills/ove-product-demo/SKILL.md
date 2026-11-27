---
name: ove-product-demo
description: Plan and build an editable MotionRender product-demo or launch reel from a website, screenshot, app, or verified feature brief. Use for SaaS walkthroughs, feature launches, and UI demonstrations.
---

# Product demos and launch reels

Build the story around a real product outcome, not generic animated interface chrome. Verify product copy, feature names, URLs, and screenshots before adding them to a video.

## Start with an evidence pack

Collect the approved product URL or screenshots, target audience, one primary promise, feature proof, CTA, brand colors, and target aspect/duration. Use a user-provided capture or obtain permission before browsing or capturing an authenticated product.

For an editable 15-second starting point, run:

```sh
mr launch-reel <url-or-screenshot> --name "Product" --tagline "Verified benefit" --cta "Call to action" --style bento --engine react --output-dir launch
```

`mr launch-reel` is a starting composition, not publication approval. Inspect its capture and replace inferred copy with verified copy.

## Direct the sequence

Use a simple progression: problem or promise → one proof moment → feature interaction → result → CTA. Let a real screenshot, capture, or UI component be the hero. Limit cursor movement to actions that prove a feature; do not animate a fake workflow just to keep the frame busy.

For a custom build, use `ove-react-video`. Keep UI state deterministic: one frame maps to one explicit application state or static capture. Treat credentials, customer data, and tokens as private; use sanitized demo data.

## Finish

Run `mr make video.tsx` (or the generated composition), open `review.png`, and check the capture is current, product copy is exact, cursor targets are obvious, and the CTA is readable in the target platform safe zones. Render a draft before the final output.
