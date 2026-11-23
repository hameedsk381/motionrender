// A ground with depth. A flat fill is what a default looks like; this layers the palette's two soft glows, a slow drift, a vignette that pulls the eye to the middle and a
// fine static grain that stops dark gradients from banding in the encoder. Put it first inside the video and everything else sits on it.
import { createElement as h, type CSSProperties, type ReactElement } from 'react';
import { useCurrentFrame } from './index';
import type { Palette } from './palette';
import { withAlpha } from './palette';

const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export type BackdropProps = {
  palette: Palette;
  /** Fine static grain over everything (default true). */ grain?: boolean;
  /** Two slowly drifting glows in the brand and accent colours (default true). */ glow?: boolean;
  style?: CSSProperties;
};

export function Backdrop({ palette: p, grain = true, glow = true, style }: BackdropProps): ReactElement {
  const t = useCurrentFrame() / 30, dark = p.mode === 'dark';
  const orb = (x: number, y: number, size: number, color: string, speed: number, phase: number) => h('div', { style: { position: 'absolute', left: `calc(${x}% + ${Math.sin(t * speed + phase) * 70}px)`, top: `calc(${y}% + ${Math.cos(t * speed * 0.8 + phase) * 50}px)`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderRadius: size, background: color, filter: 'blur(110px)' } });
  return h('div', { style: { position: 'absolute', inset: 0, overflow: 'hidden', background: p.gradients.backdrop, ...style } },
    glow ? orb(26, 24, 760, withAlpha(p.ramps.brand[dark ? 600 : 300], dark ? 0.3 : 0.26), 0.35, 0) : null,
    glow ? orb(78, 78, 820, withAlpha(p.ramps.accent[dark ? 500 : 300], dark ? 0.14 : 0.18), 0.28, 2) : null,
    grain ? h('div', { style: { position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '320px 320px', opacity: dark ? 0.07 : 0.05, mixBlendMode: dark ? 'overlay' : 'multiply' } }) : null);
}
