import type { SceneInput } from '@ove/schema';

export type SceneLayoutOptions = { width: number; height: number; durationFrames: number; font: string; ink: string; muted: string; accent: string; surface: string };

/** Explicit spatial arrangements and bounded motion, independent of copy and palette. */
export function compileSceneLayout(id: string, input: SceneInput, o: SceneLayoutOptions): { layers: any[]; note: string } | undefined {
  if (!input.layout) return;
  const w = o.width, h = o.height, m = Math.min(w, h), layers: any[] = [];
  const motion = input.choreography ?? 'reveal';
  const add = (type: string, name: string, values: Record<string, any>, order = 0) => {
    const delay = motion === 'reveal' ? 0 : Math.min(12, order * 4), finish = Math.min(o.durationFrames - 1, delay + 18);
    const animations: any[] = [{ property: 'opacity', keyframes: [{ frame: 0, value: 0 }, ...(delay ? [{ frame: delay, value: 0 }] : []), { frame: finish, value: 1, easing: 'glide' }] }];
    if (motion === 'trace' && type === 'rect' && values.width > values.height * 4) animations.push({ property: 'width', keyframes: [{ frame: delay, value: 0 }, { frame: finish, value: values.width, easing: 'glide' }] });
    else animations.push({ property: 'y', keyframes: [{ frame: delay, value: values.y + m * .025 }, { frame: finish, value: values.y, easing: 'glide' }] });
    layers.push({ id: `${id}-${name}`, type, startFrame: 0, endFrame: o.durationFrames, ...values, animations });
  };
  const type = (name: string, content: string, x: number, y: number, maxWidth: number, fontSize: number, order = 0, align = 'left', color = o.ink) => add('text', name, { content, x, y, width: maxWidth, maxWidth, fontFamily: o.font, fontWeight: 750, fontSize, minFontSize: fontSize * .7, maxLines: 4, lineHeight: 1.04, textAlign: align, color }, order);
  const line = (name: string, x: number, y: number, width: number, order = 0) => add('rect', name, { x, y, width, height: Math.max(3, m * .004), fill: o.accent }, order);
  if (input.type === 'kinetic-hook') {
    if (input.layout === 'poster') { type('headline', input.headline, w / 2, h * .26, w * .76, m * .145, 0, 'center'); line('rule', w * .38, h * .79, w * .24, 1); }
    else if (input.layout === 'split') {
      const words = input.headline.split(/\s+/), cut = Math.ceil(words.length / 2);
      type('setup', words.slice(0, cut).join(' '), w * .08, h * .2, w * .42, m * .105);
      type('payoff', words.slice(cut).join(' '), w * .55, h * .53, w * .36, m * .085, 2, 'left', o.accent);
      line('bridge', w * .08, h * .78, w * .4, 1);
    } else { line('rule', w * .08, h * .18, w * .14); type('headline', input.headline, w * .08, h * .34, w * .72, m * .12, 1); }
  } else if (input.type === 'workflow') {
    if (input.layout === 'branch') {
      type('headline', input.headline, w * .08, h * .10, w * .84, m * .064);
      type('source', input.steps[0], w * .08, h * .50, w * .26, m * .048);
      line('feed', w * .36, h * .54, w * .12, 1);
      add('rect', 'fork', { x: w * .48, y: h * .38, width: Math.max(3, m * .004), height: h * .32, fill: o.accent }, 1);
      for (const [index, outcome] of input.steps.slice(1).entries()) {
        const y = h * (.38 + index * .32);
        line(`branch-${index}`, w * .48, y, w * .10, 2);
        type(`outcome-${index}`, outcome, w * .61, y - m * .025, w * .32, m * .047, 2);
      }
    } else if (input.layout === 'vertical') {
      type('headline', input.headline, w * .08, h * .15, w * .37, m * .078);
      input.steps.forEach((step, i) => { type(`number-${i}`, `0${i + 1}`, w * .55, h * (.2 + i * .22), w * .08, m * .04, i, 'left', o.accent); type(`step-${i}`, step, w * .65, h * (.2 + i * .22), w * .27, m * .046, i); line(`stop-${i}`, w * .55, h * (.35 + i * .22), w * .36, i); });
    } else if (input.layout === 'radial') {
      type('headline', input.headline, w / 2, h * .38, w * .36, m * .062, 0, 'center');
      const points = [[.16, .2], [.7, .2], [.42, .78]];
      input.steps.forEach((step, i) => { const [x, y] = points[i]!; type(`step-${i}`, step, w * x!, h * y!, w * .25, m * .045, i + 1); line(`link-${i}`, w * x!, h * (y! - .04), w * .14, i + 1); });
    } else {
      type('headline', input.headline, w * .08, h * .13, w * .8, m * .07);
      input.steps.forEach((step, i) => { const x = w * (.09 + i * .3); type(`number-${i}`, `0${i + 1}`, x, h * .43, w * .22, m * .09, i + 1, 'left', o.accent); type(`step-${i}`, step, x, h * .65, w * .23, m * .043, i + 1); line(`link-${i}`, x, h * .59, w * .24, i + 1); });
    }
  } else if (input.type === 'before-after') {
    const stacked = input.layout === 'stacked';
    type('before', input.before, w * .09, h * .21, w * (stacked ? .8 : .35), m * .075);
    type('after', input.after, w * (stacked ? .09 : .56), h * (stacked ? .61 : .48), w * (stacked ? .8 : .35), m * .09, 2, 'left', o.accent);
    line('turn', w * .09, h * .5, w * .8, 1);
  } else if (input.type === 'decisive-cta') {
    if (input.layout === 'corner') { type('cta', input.headline, w * .08, h * .53, w * .62, m * .1, 1); line('rule', w * .08, h * .42, w * .14); }
    else if (input.layout === 'banner') { line('top', w * .08, h * .25, w * .84); type('cta', input.headline, w * .08, h * .39, w * .84, m * .095, 1); line('bottom', w * .08, h * .76, w * .84, 2); }
    else { type('cta', input.headline, w / 2, h * .34, w * .8, m * .11, 0, 'center'); line('rule', w * .37, h * .75, w * .26, 1); }
  }
  return { layers, note: `${input.type}/${input.layout}, ${motion} choreography` };
}
