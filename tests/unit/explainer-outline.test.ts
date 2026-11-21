import { describe, expect, it } from 'vitest';
import { proposeOutline } from '../../packages/core/src/explainer-outline';

const kinds = (brief: string, count?: number) => proposeOutline(brief, count).scenes.map(scene => scene.kind);

describe('explainer outline', () => {
  it('opens with a title and closes with a closing, whatever the brief', () => {
    for (const brief of ['how a bill becomes law', 'git vs svn', 'zzz', 'why the cost of solar fell 90 percent over a decade']) {
      const list = kinds(brief);
      expect(list[0]).toBe('title'); expect(list.at(-1)).toBe('closing');
    }
  });

  it('chooses the kinds the subject calls for, in telling order', () => {
    expect(kinds('git vs svn: what is the difference')).toContain('compare');
    const solar = kinds('why the cost of solar fell 90 percent over the last decade');
    expect(solar).toEqual(expect.arrayContaining(['timeline', 'stat', 'chart']));
    expect(solar.indexOf('timeline')).toBeLessThan(solar.indexOf('stat'));
    expect(kinds('how a request travels from your phone to a server')).toEqual(expect.arrayContaining(['route']));
  });

  it('gives different subjects different sequences, and the same brief the same one', () => {
    expect(kinds('how a bill becomes law')).toEqual(kinds('how a bill becomes law'));
    const set = new Set(['how a bill becomes law', 'git vs svn', 'why solar costs fell 90 percent', 'how a request travels to a server', 'the history of the printing press'].map(b => kinds(b).join('>')));
    expect(set.size).toBe(5);
  });

  it('does not pad a thin brief with scenes it does not need, and says so', () => {
    const outline = proposeOutline('git vs svn: what is the difference', 6);
    expect(outline.scenes.length).toBeLessThan(6);
    expect(outline.note).toMatch(/fewer than the 6/);
    expect(proposeOutline('zzz', 5).scenes.map(s => s.kind)).toContain('steps');
  });

  it('offers the drawings each kind can take, and points to a look', () => {
    const outline = proposeOutline('how a bill becomes law');
    expect(outline.scenes.find(s => s.kind === 'steps')!.variants).toContain('ladder');
    expect(outline.look).toBe('newsprint');
  });
});
