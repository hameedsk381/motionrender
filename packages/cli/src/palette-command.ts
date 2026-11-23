// `mr palette`: designed colour, printed. `mr palette` lists the presets (each a mood, a ground, one brand and one accent); `mr palette obsidian-ember` prints every token and its contrast;
// `mr palette --brand "#2f5bff" --accent "#ffb020" --mode dark` builds one from your own colours. The same function is `palette()` in motionrender/react.
import { PALETTES, contrast, palette, type Palette } from '../../react/src/palette';

const flag = (argv: string[], name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const ratio = (a: string, b: string) => `${contrast(a, b).toFixed(1)}:1`;

/** The tokens of a palette as printable lines, with the contrast each text colour has on its ground. */
export function describePalette(p: Palette): string {
  const row = (name: string, value: string, note = '') => `  ${name.padEnd(15)} ${value.padEnd(24)} ${note}`.trimEnd();
  return [
    `${p.mode} ground`,
    row('bg', p.bg), row('surface', p.surface, 'a card on the ground'), row('surfaceRaised', p.surfaceRaised, 'a panel above that'), row('border', p.border), row('borderStrong', p.borderStrong),
    row('text', p.text, `${ratio(p.text, p.bg)} on bg`), row('textMuted', p.textMuted, `${ratio(p.textMuted, p.bg)} on bg`), row('textFaint', p.textFaint, `${ratio(p.textFaint, p.bg)} on bg (large or decorative text only)`),
    row('accent', p.accent, `${ratio(p.accent, p.bg)} on bg`), row('onAccent', p.onAccent, `${ratio(p.onAccent, p.accent)} on accent`), row('accentSoft', p.accentSoft), row('accentStrong', p.accentStrong),
    row('brand', p.brand, `${ratio(p.brand, p.bg)} on bg`), row('secondary', p.secondary),
    '', '  ramps (50 to 950): brand ' + [50, 300, 500, 700, 950].map(s => p.ramps.brand[s as 50]).join(' '), '                     accent ' + [50, 300, 500, 700, 950].map(s => p.ramps.accent[s as 50]).join(' '), '                     neutral ' + [50, 300, 500, 700, 950].map(s => p.ramps.neutral[s as 50]).join(' '),
  ].join('\n');
}

export async function runPalette(argv: string[]): Promise<void> {
  const name = argv[1] && !argv[1].startsWith('--') ? argv[1] : undefined, json = argv.includes('--json'), brand = flag(argv, 'brand');
  if (!name && !brand) {
    if (json) { console.log(JSON.stringify(Object.entries(PALETTES).map(([key, value]) => ({ name: key, ...value })), null, 2)); return; }
    console.log(Object.entries(PALETTES).map(([key, value]) => `${key.padEnd(17)} ${value.note}\n${''.padEnd(17)} brand ${value.brand}  accent ${value.accent}  ${value.mode} ground`).join('\n') +
      '\n\nSee every token: mr palette <name>      Your own colours: mr palette --brand "#2f5bff" --accent "#ffb020" [--mode dark|light] [--harmony complement|analogous|split]\nIn code: const p = palette(\'name\') from motionrender/react, then <Backdrop palette={p} /> and p.* for every colour (mr guide design).');
    return;
  }
  const p = name ? palette(name) : palette({ brand: brand!, accent: flag(argv, 'accent'), mode: flag(argv, 'mode') === 'light' ? 'light' : 'dark', harmony: flag(argv, 'harmony') as 'complement' | 'analogous' | 'split' | undefined });
  console.log(json ? JSON.stringify(p, null, 2) : describePalette(p));
}
