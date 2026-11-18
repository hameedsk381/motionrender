import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildReact } from '../../packages/cli/src/build';
import { createRenderer, loadComposition } from '@ove/core';

it('inspects visible and clipped React text even after a cached render', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mr-react-review-'));
  try {
    const source = join(dir, 'video.tsx'), output = join(dir, 'composition.json');
    await writeFile(source, `export const config={width:640,height:360,fps:30,durationInFrames:90};
export default function Video(){return <div style={{width:640,height:360,background:'#fff'}}><h1 style={{fontSize:48,margin:0}}>Measured headline</h1><div style={{overflow:'hidden',width:80,height:25,whiteSpace:'nowrap',fontSize:32}}>Clipped content here</div><div style={{display:'none'}}>Hidden text</div><p style={{color:'#eeeeee'}}>Low contrast text</p><div style={{position:'relative',width:300,height:70}}><span>Covered text</span><div style={{position:'absolute',inset:0,zIndex:2,background:'#fff'}} /></div></div>}`);
    await buildReact(source, output);
    const composition = loadComposition(JSON.parse(await readFile(output, 'utf8')));
    const renderer = await createRenderer(composition, { baseDir: dir, allowCode: true, concurrency: 1 });
    try {
      await renderer.renderFrame(30);
      const first = await renderer.inspectFrame(30), second = await renderer.inspectFrame(30);
      expect(first.texts.find(text => text.text === 'Measured headline')).toMatchObject({ kind: 'text', size: 48, alpha: 1 });
      expect(first.texts.find(text => text.text === 'Clipped content here')?.clipped).toBe(true);
      expect(first.texts.some(text => text.text === 'Hidden text')).toBe(false);
      expect(first.texts.find(text => text.text === 'Low contrast text')?.contrast).toBeLessThan(1.5);
      expect(first.texts.find(text => text.text === 'Covered text')?.occluded).toBe(true);
      expect(second.texts).toEqual(first.texts);
    } finally { await renderer.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
