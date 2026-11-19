import { expect, it } from 'vitest';
import { explainerKindDocs, explainerSchema, sceneInputSchema } from '@ove/schema';
import { compileVideoPlan } from '@ove/core';
import { scheduleRoute } from '../../packages/timeline/src/route';

const example = explainerKindDocs.find(doc => doc.kind === 'route')!.example;
const scene = explainerSchema.parse({ topic: 'Cache', scenes: [example] }).scenes[0]!;
if (scene.kind !== 'route') throw Error('Expected route');

it('binds a cue to the same stop at different durations and never visits storage on the second trip', () => {
  for (const frames of [120, 360]) {
    const schedule = scheduleRoute(scene, frames);
    const hit = schedule.trips[1]!;
    expect(hit.visits.map(node => node.name)).toEqual(['Client', 'Cache', 'Client']);
    expect(schedule.cue.frame).toBe(hit.visits[1]!.frame);
    expect(schedule.saved?.frame).toBeLessThan(hit.start);
  }
});
it('rejects undeclared stops and events outside a trip', () => {
  for (const changes of [{ stops: ['Client','Cache'] }, { cue: { name:'bad', trip:'Second lookup', stop:'Client' } }, { cue: { name:'bad',trip:'Second lookup',visit:5 } }]) {
    expect(explainerSchema.safeParse({ topic:'Test', scenes:[{...example,...changes}] }).success).toBe(false);
  }
});
it('compiles semantic routes with review anchored to the named arrival', () => {
  const {kind, ...fields} = example;
  const input = sceneInputSchema.parse({...fields,type:kind,headline:'A second request'});
  const result = compileVideoPlan({id:'r',name:'Route',brief:{prompt:'Compare requests'},beats:[{id:'journey',intent:'Show the return',storyboard:{visible:'Request',change:'Returns early',takeaway:'Skips storage',moment:0},visual:{scene:'route',input}}]});
  expect(result.composition.scenes[0]!.metadata.storyboard).toMatchObject({cue:'Cache hit',moment:expect.any(Number)});
  expect(result.composition.scenes[0]!.layers.some(l => l.id.includes('traveler-1'))).toBe(true);
});

it('draws a rail bypass above the skipped station and still cues on arrival', () => {
  const trips = [{ name: 'Express', via: ['Central', 'Harbor'] }, { name: 'Local', via: ['Central', 'Market', 'Harbor'] }];
  const input = { type: 'route', headline: 'Compare routes', variant: 'rail', stops: ['Central', 'Harbor', 'Market'], trips,
    cue: { trip: 'Express', stop: 'Harbor', name: 'Express arrival' } };
  const { composition } = compileVideoPlan({ id: 'r', name: 'Rail', brief: { prompt: 'Compare routes' }, beats: [{
    id: 'rail', intent: 'Skip the station', visual: { scene: 'route', input },
    storyboard: { visible: 'Three stations', change: 'Express bypasses Market', takeaway: 'Express skips Market', moment: 0 },
  }] });
  const scene = composition.scenes[0]!;
  const express = scene.layers.find(l => l.id === 'rail-traveler-0')!;
  const y: { frame: number; value: number }[] = express.animations.find((a: { property: string }) => a.property === 'y')!.keyframes;
  expect(y.map(key => key.value)).toEqual([express.y, expect.any(Number), expect.any(Number), express.y]);
  expect(y[1]!.value).toBeLessThan(express.y as number);
  const moment = (scene.metadata.storyboard as { moment: number }).moment;
  expect(express.startFrame + y.at(-1)!.frame).toBe(Math.round(moment * (scene.durationFrames - 1)));
});
