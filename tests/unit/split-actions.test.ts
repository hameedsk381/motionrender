import { expect, it } from 'vitest';
import { compileVideoPlan } from '@ove/core';
import { sceneInputSchema } from '@ove/schema';

const input = {type:'split', headline:'Rain at the surface', origin:'Surface', branches:[
  {endpoint:'Runoff',direction:'right'}, {endpoint:'Infiltration',direction:'down'},
]};
it('rejects coincident branches and ambiguous endpoints', () => {
  for (const change of [{direction:'right'}, {endpoint:'Runoff'}, {endpoint:'Surface'}]) {
    expect(sceneInputSchema.safeParse({...input, branches:[input.branches[0], {...input.branches[1], ...change}]}).success).toBe(false);
  }
});
it.each(['fork', 'manifold'])('starts both %s travelers together and binds review to their arrival', variant => {
  const plan = {id:'sample',name:'Sample',brief:{prompt:'Rain'},beats:[{id:'b',intent:'Split',durationSeconds:4,visual:{scene:'split',input:{...input, variant}}, storyboard:{visible:'Two paths',change:'Separate',takeaway:'Both happen',moment:0}}]};
  const scene = compileVideoPlan(plan).composition.scenes[0]!;
  const moving = scene.layers.filter(l => l.id.includes('traveler'));
  expect(moving).toHaveLength(2);
  const [a,b]=moving;
  expect(a!.startFrame).toBe(b!.startFrame);
  expect([a!.x,a!.y]).toEqual([b!.x,b!.y]);
  const end = (layer:typeof a, prop:string) => layer!.animations.find((anim: {property:string})=>anim.property===prop)!.keyframes.at(-1)!;
  expect(end(a,'x').value).toBeGreaterThan(a!.x as number);
  if (variant === 'fork') expect(end(a,'y').value).toBe(a!.y);
  else {
    for (const prop of ['x', 'y']) {
      const shared = (layer: typeof a) => layer!.animations.find((anim: { property: string }) => anim.property === prop)!.keyframes.slice(0, 2);
      expect(shared(a)).toEqual(shared(b));
    }
  }
  expect(end(b,'x').value).toBe(b!.x);
  expect(end(b,'y').value).toBeGreaterThan(b!.y as number);
  expect(end(a,'x').frame).toBe(end(b,'x').frame);
  expect(Math.round((scene.durationFrames-1)*(scene.metadata.storyboard as {moment:number}).moment)).toBe(a!.startFrame+end(a,'x').frame);
});
