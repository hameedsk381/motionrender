import { describe, expect, it } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Illustration, illustrationNames } from '@ove/react';

// The illustrations are pictures of a scene's subject drawn in the video's own colours, with no image model or key. They are pure in the frame, like the kit.
const shared = (globalThis as any).__oveReact as { frame: any; config: any };
const config = { id: 't', width: 640, height: 360, fps: 30, durationInFrames: 90 };
const at = (frame: number, node: ReactNode) => renderToStaticMarkup(createElement(shared.config.Provider, { value: config }, createElement(shared.frame.Provider, { value: frame }, node)));

describe('illustrations', () => {
  it('has a picture for the usual subjects of a topic video', () => {
    for (const name of ['server', 'phone', 'person', 'building', 'document', 'ballot', 'globe', 'panel', 'lock', 'coin']) expect(illustrationNames, name).toContain(name);
    expect(illustrationNames.length).toBeGreaterThanOrEqual(18);
  });

  it('draws every one, in the colours it is given', () => {
    for (const name of illustrationNames) {
      const svg = at(60, createElement(Illustration, { name, color: '#b3121f', ink: '#161513', paper: '#f2ede2', drawn: true }));
      expect(svg, name).toContain('<svg');
      expect(svg, name).toContain('stroke="#161513"');
      expect(svg, name).toMatch(/fill="#b3121f"|fill="#f2ede2"|fill="#161513"/);
    }
  });

  it('draws itself on from its delay: nothing before it, the outline then the colour after', () => {
    const before = at(0, createElement(Illustration, { name: 'server', delay: 30 })), later = at(60, createElement(Illustration, { name: 'server', delay: 30 }));
    expect(before).toMatch(/stroke-dashoffset="1\.1"/);
    expect(before).toMatch(/stroke-dasharray="1 1\.2"/);
    expect(later).not.toMatch(/stroke-dashoffset="1\.1"/);
    expect(at(0, createElement(Illustration, { name: 'server', delay: 30, drawn: true }))).toMatch(/stroke-dashoffset="0"/);
  });

  it('says which names exist when asked for one that does not', () => {
    expect(() => at(0, createElement(Illustration, { name: 'unicorn' }))).toThrow(/Unknown illustration "unicorn".*server/);
  });
});
