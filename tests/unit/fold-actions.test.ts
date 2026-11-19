import { expect, it } from 'vitest';
import { compileVideoPlan } from '@ove/core';

it.each([
  ['right-to-left', 'sheet'], ['left-to-right', 'sheet'], ['right-to-left', 'booklet'], ['left-to-right', 'booklet'],
])('keeps the %s %s anchored and binds review to the closed cover', (direction, variant) => {
  const input = {type:'fold',headline:'Pocket atlas',direction,variant,artwork:'map',inside:'Street Grid',cover:'Pocket Atlas'};
  const {composition} = compileVideoPlan({id:'f',name:'Fold',brief:{prompt:'Close the map'},beats:[{
    id:'sheet',intent:'Reveal the cover',durationSeconds:4,visual:{scene:'fold',input},
    storyboard:{visible:'A map',change:'The cover turns',takeaway:'Pocket sized',moment:0},
  }]});
  const scene = composition.scenes[0]!;
  const [fixed,front,back] = ['fixed','inside','cover'].map(face => scene.layers.find(l => l.id === 'sheet-'+face)!);
  expect(front!.x).toBe(fixed!.x);
  expect(back!.x).toBe(fixed!.x);
  expect(front!.endFrame).toBe(back!.startFrame);
  expect(scene.metadata.storyboard).toMatchObject({cue:'Cover closed'});
  const arrival = back!.animations[0]!.keyframes.at(-1)!;
  expect(back!.startFrame+arrival.frame).toBe(Math.round((scene.durationFrames-1)*(scene.metadata.storyboard as {moment:number}).moment));
  expect(arrival.value).toBe(1);
  if (variant === 'booklet') expect(back!.animations[0]!.keyframes[1]).toMatchObject({ value: 0 });
});
