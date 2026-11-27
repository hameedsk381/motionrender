---
name: ove-webgl-shaders
description: Build deterministic WebGL, Three.js, and shader-backed MotionRender scenes with a defined performance and fallback plan. Use for product worlds, particles, generative backgrounds, and 3D visualizations; avoid it for ordinary UI or typography.
---

# WebGL and shader scenes

Use 3D or shaders only when depth, material, spatial motion, or generative imagery communicates something that 2D cannot. Define the visual purpose and the fallback before implementation.

## Author deterministically

Use `ove-react-video` and the `motionrender/world` or `@ove/react` surface for trusted code scenes. Derive camera, uniforms, simulation time, and seeded variation solely from the requested frame and composition FPS. Do not depend on wall-clock time, uncontrolled requestAnimationFrame progression, browser physics state, or unseeded randomness.

Keep asset files local and declared. Fix device pixel ratio and resolution where visual output depends on them. Provide a Canvas or static-image fallback for environments where WebGL, a GPU, or a required extension is unavailable.

## Respect the render budget

Start with the smallest viable geometry, texture, and particle count. Avoid per-frame allocation and heavyweight post-processing until a draft proves they materially improve the image. Test at the target output resolution—not only in a small live preview.

## Validate

Run `mr make video.tsx`, inspect stills at the beginning, middle, and end of the scene, then render a scaled draft. Look for shader compilation errors, black frames, aliasing, unstable text, and differences between preview and headless output. Keep the fallback active until the target renderer has passed these checks.
