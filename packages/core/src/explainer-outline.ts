// A scene sequence proposed from the subject, before any script exists. What a brief is about decides which scene kinds it needs (a process
// wants steps or a route, a comparison wants two sides, a number wants a stat and often a chart, a history wants a timeline) and the order they
// tell it in: a hook, the problem, the mechanism, the evidence, the takeaway. Two subjects get two different sequences; the same brief the same one.
import { explainerVariants, type ExplainerLook } from '@ove/schema';
import { moodOfText } from './explainer-auto-look';

const hash = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** What in a brief calls for each scene kind, and where in the story it belongs (lower is earlier). */
const KINDS: Record<string, { signals: RegExp; rank: number; purpose: string }> = {
  compare: { signals: /\bvs\b|versus|differen|compar|better|worse|pros|cons|before and after|myth|instead|alternative|trade-?off/g, rank: 1, purpose: 'Two sides: the problem and the answer, or option A and option B.' },
  pile: { signals: /backlog|overflow|volume|pile|crowd|waste|flood|congest/g, rank: 1, purpose: 'Many small things piling up: load, volume, a backlog.' },
  flow: { signals: /traffic|queue|load|scal|spike|demand|throughput|request|users|bandwidth|cache|buffer/g, rank: 2, purpose: 'Senders, a buffer in the middle, a sink: anything that arrives faster than it is handled.' },
  phone: { signals: /\bapp\b|notif|message|chat|text me|alert|social|inbox|email/g, rank: 2, purpose: 'A phone and its chat bubbles: what the user sees and does.' },
  grid: { signals: /heat|density|counter|cells?|hotspot|region|zones?/g, rank: 2, purpose: 'A grid of numbers or a heatmap with a hot area.' },
  hex: { signals: /shard|district|neighbo|cell|territor|zones?/g, rank: 2, purpose: 'Hexagon cells, some lit: regions, zones, shards.' },
  world: { signals: /\bcity\b|cities|world|earth|climate|terrain|landscape|data cent|global|planet/g, rank: 2, purpose: 'A 3D place the camera moves through.' },
  media: { signals: /\bphoto|footage|visit|place|product|picture|site\b/g, rank: 2, purpose: 'A real picture or clip in a frame (needs a file or stock key).' },
  timeline: { signals: /histor|timeline|evolution|origin|decade|century|roadmap|stages?|era\b|milestone|years?\b/g, rank: 3, purpose: 'Two to six events down a line.' },
  route: { signals: /journey|path|travel|deliver|supply chain|\bbill\b|route|trip|commute|handshake|lookup|hops?|passes through/g, rank: 3, purpose: 'A traveller visiting named stops, trip by trip.' },
  split: { signals: /branch|split|divide|distribut|fork|two paths|fan out/g, rank: 3, purpose: 'One source feeding two diverging paths.' },
  fold: { signals: /\bmap\b|zine|brochure|letter|pamphlet|fold|pocket/g, rank: 3, purpose: 'A printed sheet folding to reveal its cover.' },
  steps: { signals: /\bhow\b|steps?|process|works?|recipe|guide|method|pipeline|procedure|stages?/g, rank: 3, purpose: 'Two to five numbered steps, one after another.' },
  code: { signals: /\bcode\b|function|\bapi\b|algorithm|compil|query|\bsql\b|program|script|command|syntax/g, rank: 3, purpose: 'A code editor with highlighted lines.' },
  chart: { signals: /trend|over time|growth|by year|ranking|top \d|statistic|compare .* (countries|years|regions)|rate|share|index|fell|fall|rose|rise|dropp?|increase|decrease|decline|changed?/g, rank: 4, purpose: 'Bars or a line: two to eight values with one highlighted.' },
  stat: { signals: /\d|percent|%|million|billion|thousand|average|cost|price|users|rate|growth|data|figure|number|how (many|much)/g, rank: 4, purpose: 'One figure that matters, with its source in the note.' },
  quote: { signals: /\bsaid\b|\bsays\b|quote|speech|according to|report states|statement/g, rank: 5, purpose: 'Words from a real source, quoted exactly (never invented).' },
};

export type OutlineScene = { kind: string; purpose: string; variants: string[] };
export type Outline = { look: ExplainerLook; subject: string[]; scenes: OutlineScene[]; /** Set when the brief supports fewer scenes than asked for. */ note?: string };

/** Proposes `count` scenes (3 to 9, default 6) for a brief: a title, the kinds the subject calls for in telling order, a closing. */
export function proposeOutline(brief: string, count = 6): Outline {
  const text = ` ${brief.toLowerCase()} `, seed = hash(brief.trim().toLowerCase());
  const middle = Math.max(1, Math.min(9, count) - 2);
  const scored = Object.entries(KINDS).map(([kind, info]) => ({ kind, info, score: (text.match(info.signals) ?? []).length, tie: hash(`${seed}:${kind}`) }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie);
  const wanted = scored.filter(item => item.score > 0).slice(0, middle);
  // Only what the brief calls for: a short list is a short video. A brief that calls for nothing in particular still explains something, so it gets steps.
  if (!wanted.length) wanted.push(scored.find(item => item.kind === 'steps')!);
  const history = (text.match(KINDS.timeline!.signals) ?? []).length >= 2;
  const ordered = wanted.sort((a, b) => (history && a.kind === 'timeline' ? 0 : a.info.rank) - (history && b.kind === 'timeline' ? 0 : b.info.rank) || b.score - a.score || a.tie - b.tie);
  const pickVariants = (kind: string) => explainerVariants[kind] ?? [];
  const scenes: OutlineScene[] = [
    { kind: 'title', purpose: 'The hook: the question or promise, with a short brand word.', variants: pickVariants('title') },
    ...ordered.map(item => ({ kind: item.kind, purpose: item.info.purpose, variants: pickVariants(item.kind) })),
    { kind: 'closing', purpose: 'The takeaway: a big title, up to three ticked points, a call to action.', variants: pickVariants('closing') },
  ];
  const mood = moodOfText(brief, brief);
  const asked = Math.max(3, Math.min(9, count));
  return { look: mood.look, subject: wanted.filter(item => item.score > 0).map(item => item.kind), scenes, ...(scenes.length < asked ? { note: `The brief calls for ${scenes.length} scenes, fewer than the ${asked} asked for: add more only where the story has another beat.` } : {}) };
}
