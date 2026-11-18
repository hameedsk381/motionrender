import { expect, it } from 'vitest';
import { parseVideoMarkdown, compileVideoPlan, reviewComposition } from '@ove/core';

it.each(['16:9', '9:16'])('includes the planned motion and decisive frame in %s review', async format => {
  const plan = parseVideoMarkdown(`---
title: Water cycle
format: ${format}
---
# Show condensation
Duration: 1s
Scene: workflow
Scene-input: {"type":"workflow","layout":"branch","choreography":"trace","headline":"Where rain goes","steps":["Rain","Runoff","Infiltration"]}
On-screen: Where rain goes
Visible: Rain connected to two destinations
Change: Two branches extend from the source
Takeaway: Rain follows two paths
Moment: 0.75
`);
  const { composition } = compileVideoPlan(plan);
  const result = await reviewComposition(composition, { sheetFrames: 2, every: 15, audio: false });
  expect(result.checkpoints?.[0]).toMatchObject({ frame: 22, motionFrames: [14, 22, 29], takeaway: 'Rain follows two paths' });
  expect(result.sheetFrames).toEqual(expect.arrayContaining([14, 22, 29]));
});
