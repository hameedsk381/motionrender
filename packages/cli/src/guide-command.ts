// `mr guide [name]`: the craft guides, printed. `mr guide` lists them; `mr guide floor` prints the quality floor every video is held to, `mr guide layout` how to let the content
// decide the page, and so on. They are plain Markdown that ships with the package, so an agent can read one when it needs it instead of carrying them all.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const guidesRoot = fileURLToPath(new URL('../guides', import.meta.url));

export type Guide = { name: string; title: string; text: string };

/** Every guide: its name (the file name), its first line as a title, and its text. */
export async function readGuides(root = guidesRoot): Promise<Guide[]> {
  const files = (await readdir(root)).filter(file => file.endsWith('.md')).sort();
  return Promise.all(files.map(async file => {
    const text = (await readFile(join(root, file), 'utf8')).replace(/\r\n/g, '\n'), name = file.replace(/\.md$/, '');
    return { name, title: text.split('\n', 1)[0]!.replace(/^#\s*/, '').replace(new RegExp(`^${name}:\\s*`), ''), text };
  }));
}

export async function runGuide(argv: string[]): Promise<void> {
  const name = argv[1], guides = await readGuides();
  if (!name || name.startsWith('--')) {
    if (argv.includes('--json')) { console.log(JSON.stringify(guides.map(({ name, title }) => ({ name, title })), null, 2)); return; }
    console.log(guides.map(guide => `${guide.name.padEnd(10)} ${guide.title}`).join('\n') + '\n\nRead one with: mr guide <name>   (mr guide floor is what every video is held to)');
    return;
  }
  const guide = guides.find(item => item.name === name);
  if (!guide) throw new Error(`No guide called "${name}". The guides are: ${guides.map(item => item.name).join(', ')}`);
  console.log(argv.includes('--json') ? JSON.stringify(guide, null, 2) : guide.text);
}
