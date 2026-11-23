import { describe, expect, it } from 'vitest';
import { PALETTES, contrast, fromOklch, gradient, glow, mix, palette, ramp, shadow, toOklch, withAlpha } from '../../packages/react/src/palette';
import { describePalette } from '../../packages/cli/src/palette-command';

// Colour built the way a designer builds it: even steps in OKLCH, tinted neutrals, one accent, text that clears its contrast, depth that carries the hue.
describe('OKLCH colour', () => {
  it('round-trips a hex colour', () => {
    for (const hex of ['#2f5bff', '#e8501f', '#ffb020', '#0b1428', '#f4efe6']) {
      const { l, c, h } = toOklch(hex), back = fromOklch(l, c, h);
      const diff = [1, 3, 5].map(i => Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(back.slice(i, i + 2), 16)));
      expect(Math.max(...diff), hex).toBeLessThanOrEqual(1);
    }
  });
  it('keeps lightness and hue and drops only chroma for a colour outside sRGB', () => {
    const out = toOklch(fromOklch(0.6, 0.4, 150));
    expect(out.l).toBeCloseTo(0.6, 1);
    expect(out.c).toBeLessThan(0.4);
  });
  it('mixes through colour, not through grey', () => {
    expect(toOklch(mix('#2f5bff', '#ffb020', 0.5)).c).toBeGreaterThan(0.06);
    expect(gradient('#2f5bff', '#ffb020')).toMatch(/^linear-gradient\(160deg, .* 100%\)$/);
  });
  it('makes a ramp that steps evenly from light to dark', () => {
    const lightness = Object.values(ramp(250, 0.15)).map(hex => toOklch(hex).l);
    for (let i = 1; i < lightness.length; i++) expect(lightness[i]!).toBeLessThan(lightness[i - 1]!);
  });
  it('rejects something that is not a colour', () => { expect(() => toOklch('blue')).toThrow(/Not a colour/); });
});

describe('palettes', () => {
  it('ships a dozen presets, dark and light', () => {
    const names = Object.keys(PALETTES);
    expect(names.length).toBeGreaterThanOrEqual(12);
    expect(names.filter(n => PALETTES[n]!.mode === 'light').length).toBeGreaterThanOrEqual(4);
    expect(names.filter(n => PALETTES[n]!.mode === 'dark').length).toBeGreaterThanOrEqual(6);
  });
  it('every preset clears the contrast a video needs and never uses pure black or white', () => {
    for (const name of Object.keys(PALETTES)) {
      const p = palette(name);
      expect(contrast(p.text, p.bg), `${name} text`).toBeGreaterThanOrEqual(7);
      expect(contrast(p.textMuted, p.bg), `${name} muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, p.bg), `${name} accent`).toBeGreaterThanOrEqual(3);
      expect(contrast(p.onAccent, p.accent), `${name} onAccent`).toBeGreaterThanOrEqual(4.5);
      for (const hex of [p.bg, p.surface, p.text]) expect(['#000000', '#ffffff'], `${name} ${hex}`).not.toContain(hex);
      const ground = toOklch(p.bg).l;
      if (p.mode === 'dark') expect(ground, name).toBeGreaterThan(0.1); else expect(ground, name).toBeLessThan(0.99);
    }
  });
  it('raises surfaces by lightness on a dark ground and keeps the ground tinted', () => {
    const p = palette('midnight-signal');
    expect(toOklch(p.surface).l).toBeGreaterThan(toOklch(p.bg).l);
    expect(toOklch(p.surfaceRaised).l).toBeGreaterThan(toOklch(p.surface).l);
    expect(toOklch(p.bg).c).toBeGreaterThan(0.01);
  });
  it('builds a palette from a brand colour alone, choosing the accent from a harmony', () => {
    const p = palette({ brand: '#1f8a5f', harmony: 'complement' });
    expect(Math.abs(((toOklch(p.accent).h - toOklch('#1f8a5f').h + 540) % 360) - 180)).toBeGreaterThan(140);   // the opposite side of the wheel
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('names the presets when asked for one that does not exist', () => { expect(() => palette('neon-everything')).toThrow(/midnight-signal/); });
  it('prints every token with its contrast', () => {
    const text = describePalette(palette('alabaster-ink'));
    for (const word of ['bg', 'surface', 'text', 'textMuted', 'accent', 'onAccent', 'ramps']) expect(text).toContain(word);
    expect(text).toMatch(/\d+\.\d:1 on bg/);
  });
});

describe('depth', () => {
  it('tints a glow and a shadow with the colour, not with black', () => {
    expect(glow('#ffb020')).toContain('rgba(255, 176, 32');
    expect(shadow('#0b1428', 3)).not.toMatch(/rgba\(0, 0, 0/);
    expect(withAlpha('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });
});
