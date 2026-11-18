# Semantic video plans

`video.plan.json` is the authoring surface for agents and teams who want to describe a video without managing coordinates, layers or keyframes. It is compiled to `composition.json`, which remains the canonical deterministic render input.

`video.md` is the recommended human- and agent-facing equivalent. It uses a small Markdown grammar: front matter for project metadata, `#` headings for beats, labelled lines for typed fields, and `>` directives for variables and sources. Both formats compile to the identical semantic plan.

```text
video.plan.json → production manifest → composition.json → review/render
```

Each beat describes its communication intent, duration, on-screen copy, narration and optional media. If a beat has no `visual.asset`, compilation creates an editable text-card placeholder rather than inventing footage.

```powershell
mr plan validate examples/semantic-plan/video.plan.json
mr plan validate examples/semantic-plan/video.md
mr plan compile examples/semantic-plan/video.plan.json
mr make examples/semantic-plan/video.md --draft
```

## Natural-language director loop

Start from a brief when there is no plan yet. The director writes `video.md`, validates it against the semantic contract, then gives the model the plan-review warnings once so it can repair its own pacing, copy, or missing visual direction. It never accepts uncited factual claims.

```powershell
mr plan direct "Launch a calmer support inbox for busy operators" --format 9:16 --duration 15 --output video.md
mr make video.md --draft
```

Use `--provider`, `--model`, and `--base-url` to select the same provider configuration used by `mr ai`. The result remains a normal editable Markdown plan: change it by hand, run `mr plan review video.md`, and compile/render only when the narrative is ready.

## Scene catalog and contracts

`visual.scene` says what a beat communicates, rather than how to draw it. The built-in catalog includes `kinetic-hook`, `product-ui`, `before-after`, `proof-stat`, `workflow`, `comparison-grid`, `quote-proof`, `feature-bento`, `media-moment`, and `decisive-cta`. Each scene has required inputs, and plan review catches an incomplete selection before compilation.

```powershell
mr plan catalog "compare the old workflow before and after"
```

For example, an evidence-stat scene must carry a claim, cited source ids, and displayed data. An approved custom visual can omit `visual.scene`; the catalog guides the director but does not constrain new scene modules.

The compiler turns a selected scene into editable primitive layers. `before-after` creates two contrasting panels, `workflow` creates an input/process/outcome map, `proof-stat` creates an evidence-led number treatment, while hooks, bento grids, and CTAs get their own typography and hierarchy. A supplied media asset remains underneath the generated primitives; a React scene module still takes precedence when the design needs custom code.

## Asset intelligence

Declare assets once with their type, approval state, rights, and useful metadata such as `tags`, `title`, or `description`. Then inspect what each beat can safely use before attaching an asset:

```powershell
mr plan assets video.md --beat product-proof
```

Recommendations are explainable: they rank matching visual type, catalog-scene fit, metadata terms, approval state, and commercial rights. Rejected, superseded, restricted, or non-visual assets are penalized, and `mr plan review` reports an invalid selected asset before a render starts. MCP agents can use `motionrender_plan_assets` for the same result.

## Render review → semantic repair

`mr make video.md` already renders a contact sheet and runs design checks. For semantic plans its report now includes proposed beat-level repairs for review findings such as unreadable copy, unsafe placement, frozen holds, and mixed transitions. Proposals are never applied automatically: inspect their reversible operations, then use `mr plan edit`.

MCP agents can pass the structured findings from `motionrender_review_video` to `motionrender_plan_repair`; it maps review frames to beat ids and returns only suggested semantic edit operations.

## Approval and release handoff

Record a checkpoint through the normal semantic edit surface, then generate a release manifest. A manifest contains the plan digest, output details, requested delivery channels, localization/personalization variables, final-approval state, and every blocker; it does not publish anything.

```json
[{ "op": "set-approval", "approval": { "stage": "final", "approved": true, "at": "2026-11-18T10:00:00Z", "note": "Checked delivery" } }]
```

```powershell
mr plan edit video.plan.json --edits approval.json
mr plan release video.plan.edited.json --channel web --channel tiktok --output release.json
```

Without an approved final checkpoint, the release manifest is intentionally `blocked`. Use `motionrender_plan_release` to obtain the same handoff from an MCP agent, and then feed the declared variables into the existing batch renderer for localized or personalized outputs.

## Collaboration status

Plans can hold durable comments on an individual beat or the whole narrative. Add and resolve them through `mr plan edit`; comments are retained for auditability. Approval changes also append to `approvalHistory`, while `approvals` holds the current checkpoint state.

```powershell
mr plan status video.plan.json --channel web
```

The status object is a release dashboard: open comments by beat, current and historical approvals, and all release blockers in one response. MCP clients use `motionrender_plan_status` to show the same shared review state.

Use a declared image or video asset when one is ready:

```json
{
  "assets": [{ "id": "dashboard", "type": "image", "src": "./assets/dashboard.png" }],
  "beats": [{
    "id": "proof",
    "intent": "Prove the workflow",
    "durationSeconds": 4,
    "visual": { "asset": "dashboard", "media": "image", "fit": "cover", "transition": "fade" }
  }]
}
```

An agent can obtain the schema and work with plans directly through `motionrender_schema` (`kind: "video-plan"`), `motionrender_plan_validate`, and `motionrender_plan_compile`.

## Reusable scene modules

For an expressive UI, chart, canvas or 3D scene, a plan may reference a trusted React bundle built with `mr build`. The module always fills its beat and gets `frame`, `t`, `fps` and `durationInFrames` from the renderer; its values remain deterministic. It also gets the beat’s intent/copy/narration plus declared assets as props.

```json
{
  "sceneModules": [{
    "id": "product-proof",
    "src": "./product-proof.bundle.js",
    "assets": ["dashboard"],
    "props": { "theme": "midnight" }
  }],
  "beats": [{
    "id": "proof",
    "intent": "Prove the workflow",
    "durationSeconds": 4,
    "visual": { "module": "product-proof", "props": { "metric": "42%" } }
  }]
}
```

Modules execute JavaScript, so renders require `--allow-code`. They are intended for reviewed, versioned code—not arbitrary model output.

## Intent-preserving edits

Refine a plan through named beats rather than generated scene/layer identifiers. The operation file is an auditable semantic diff:

```json
[
  { "op": "update-beat", "id": "problem", "changes": { "onScreen": "One inbox, not six tabs.", "durationSeconds": 3 } },
  { "op": "move-beat", "id": "outcome" },
  { "op": "insert-beat", "after": "outcome", "beat": { "id": "cta", "intent": "Ask for the next step", "onScreen": "See it in action" } }
]
```

Run `mr plan edit video.plan.json --edits edits.json`. It writes `video.plan.edited.json` by default rather than overwriting the source plan, and prints the resulting beat-level change list. MCP clients can use `motionrender_plan_edit` to get the refined plan and diff without writing a file.

Before compilation, compare two revisions with `mr plan diff before.plan.json after.plan.json` or `motionrender_plan_diff`. The diff reports beat additions/removals/reordering, changed intent/copy/timing/evidence/visuals, source changes, style changes, and total duration impact.

Run `mr plan review video.plan.json` (or `motionrender_plan_review`) before compilation to catch narrative issues without rendering: target-duration mismatch, uniform pacing, copy reading time, narration speed, unused sources, and visual placeholders.

## Personalized and localized variants

Declare typed variables in a plan and use `{{variable}}` in copy, narration, module props, or asset paths. Compilation passes them to `composition.json`, so the existing variable and batch renderer applies them before schema validation.

```json
{
  "variables": {
    "customer": { "type": "string", "default": "Acme" },
    "discount": { "type": "number", "default": 20 }
  },
  "beats": [{
    "id": "offer",
    "intent": "Make the offer",
    "onScreen": "{{customer}} saves {{discount}}%"
  }]
}
```

Compile the plan, then use the existing batch renderer with a JSON array of variable rows and an output pattern such as `out/{{customer}}.mp4`.

## Review-to-repair loop

`mr make` and `motionrender_review_video` now turn automated review findings into repair tasks. A task is mapped back to the active scene and, when the composition came from a video plan, its beat id. This lets an agent change the narrative plan rather than trying to manipulate generated layer ids.

For example, an off-frame headline becomes a `layout` task for the beat that owns it; an unreadable long card becomes a `copy` task; a static hold becomes a `motion` task. The task preserves the review evidence and says what must remain intact, but leaves the creative choice reversible.

## Factual beats and evidence

Plans can make factual product or market claims, but every claim and displayed figure must cite a source with a verified supporting quote. The compiler preserves this evidence in `composition.content`, so the final video, script export, and audit trail all agree.

```json
{
  "sources": [{
    "id": "benchmark",
    "title": "Support benchmark",
    "url": "https://example.com/benchmark",
    "quote": "Teams using one workspace resolved tickets 42% faster."
  }],
  "beats": [{
    "id": "proof",
    "intent": "Prove the result",
    "onScreen": "42% faster resolution",
    "claim": "Teams resolved tickets 42% faster.",
    "sourceIds": ["benchmark"],
    "data": [{ "label": "Resolution speed", "value": 42, "unit": "%", "sourceIds": ["benchmark"] }]
  }]
}
```
