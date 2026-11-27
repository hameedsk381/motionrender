import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { buildReact } from '../../packages/cli/src/build';
import { reactVisualCheck } from '../../packages/cli/src/react-video';
import { createRenderer, loadComposition, reviewComposition } from '@ove/core';

it('rejects the wrong duration and checks copy in the rendered video rather than the source', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mr-react-brief-'));
  try {
    const source = join(dir, 'video.tsx'), output = join(dir, 'composition.json');
    await writeFile(source, `export const config = { width:640,height:360,fps:30,durationInFrames:60 };
export default function Video() {
  return <div style={{background:'#fff',color:'#111',padding:30}}>
    <div style={{fontSize:40}}>MAKE ROOM</div><div style={{fontSize:40}}>FOR SIGNAL</div>
    <div style={{display:'none'}}>HIDDEN COPY</div>
  </div>;
}`);
    await buildReact(source, output);
    const wrongLength = await reactVisualCheck(dir, undefined, { seconds: 12, copy: [] })(source, output);
    expect(wrongLength).toMatchObject({ passed: false, report: expect.stringContaining('Required 12s') });
    const copy = await reactVisualCheck(dir, undefined, { seconds: 2, copy: ['MAKE ROOM FOR SIGNAL', 'HIDDEN COPY'] })(source, output);
    expect(copy.passed).toBe(false);
    expect(copy.report).toContain('required-copy: No sampled frame showed the exact visible phrase "HIDDEN COPY"');
    expect(copy.report).not.toContain('required-copy: No sampled frame showed the exact visible phrase "MAKE ROOM FOR SIGNAL"');
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 60_000);

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

it('reviews landscape web labels at a smaller scale and still catches tiny text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mr-review-target-'));
  try {
    const source = join(dir, 'video.tsx'), output = join(dir, 'composition.json');
    await writeFile(source, `export const config = {width:1920,height:1080,fps:30,durationInFrames:60};
export default function Video() {
  return <div style={{position:'absolute',inset:0,background:'#fff',color:'#000',padding:80}}>
    <p style={{fontSize:16}}>Project label</p><p style={{fontSize:10}}>Tiny label</p>
  </div>;
}`);
    await buildReact(source, output);
    const composition = loadComposition(JSON.parse(await readFile(output, 'utf8')));
    const options = { baseDir: dir, allowCode: true, audio: false, every: 15, sheetFrames: 2, concurrency: 1 };
    const social = await reviewComposition(composition, options);
    const web = await reviewComposition(composition, { ...options, target: 'web' });
    const smallText = (report: typeof web) => report.issues.filter(issue => issue.code === 'small-text').map(issue => issue.message);
    expect(smallText(social).join('\n')).toContain('Project label');
    expect(smallText(web)).toHaveLength(1);
    expect(smallText(web)[0]).toContain('Tiny label');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
