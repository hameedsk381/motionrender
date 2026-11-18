// A small semantic scene catalogue. It is intentionally independent of blocks or a renderer: a director chooses
// the communication shape first, then the compiler or a custom module decides how to draw that shape.
export type SceneContractField = { name: string; required?: boolean; description: string };
export type SceneCatalogEntry = {
  id: string;
  name: string;
  purpose: string;
  useWhen: string[];
  avoidWhen: string[];
  inputs: SceneContractField[];
  keywords: string[];
};
export type SceneCatalogQuery = { intent?: string; onScreen?: string; visualDirection?: string; hasMedia?: boolean };
export type SceneRecommendation = SceneCatalogEntry & { score: number; reasons: string[]; missing: string[] };

export const sceneCatalog: readonly SceneCatalogEntry[] = [
  { id: 'kinetic-hook', name: 'Kinetic hook', purpose: 'Make one sharp opening thought impossible to miss.', useWhen: ['opening a short video', 'revealing a contrarian idea or tension'], avoidWhen: ['explaining a multi-step process', 'showing a sourced number'], inputs: [{ name: 'onScreen', required: true, description: 'A short, provocative line (ideally under 9 words).' }, { name: 'visual.direction', description: 'One active image, object, or typographic action.' }], keywords: ['hook', 'open', 'attention', 'problem', 'why', 'stop'] },
  { id: 'product-ui', name: 'Product UI walkthrough', purpose: 'Show a software interaction or interface change concretely.', useWhen: ['there is a screenshot, recording, or UI to demonstrate', 'the claim is about workflow'], avoidWhen: ['no actual product or credible mock is available', 'the main idea is emotional rather than functional'], inputs: [{ name: 'visual.asset', required: true, description: 'A product screenshot, recording, or approved mock asset.' }, { name: 'onScreen', description: 'A single task or outcome.' }], keywords: ['product', 'app', 'dashboard', 'workflow', 'inbox', 'click', 'ui', 'software'] },
  { id: 'before-after', name: 'Before / after', purpose: 'Make a transformation or contrast legible at a glance.', useWhen: ['comparing an old and new state', 'showing a customer outcome without needing a chart'], avoidWhen: ['there are more than two alternatives', 'the difference depends on a detailed sequence'], inputs: [{ name: 'onScreen', required: true, description: 'The contrast, stated in two short fragments.' }, { name: 'visual.direction', required: true, description: 'What visibly changes between the two sides.' }], keywords: ['before', 'after', 'old', 'new', 'versus', 'vs', 'instead', 'transform'] },
  { id: 'proof-stat', name: 'Evidence stat', purpose: 'Give one verified number enough visual weight to be believed and remembered.', useWhen: ['a sourced metric is the central proof', 'the viewer only needs one figure'], avoidWhen: ['the number is uncited', 'several figures need comparison'], inputs: [{ name: 'claim', required: true, description: 'The factual statement.' }, { name: 'sourceIds', required: true, description: 'Verified source ids backing the statement.' }, { name: 'data', required: true, description: 'The displayed figure and its source ids.' }], keywords: ['%', 'percent', 'faster', 'growth', 'metric', 'stat', 'result', 'increase', 'decrease'] },
  { id: 'workflow', name: 'Workflow map', purpose: 'Explain how inputs travel through a system to an outcome.', useWhen: ['teaching a process or mechanism', 'a sequence has handoffs or dependencies'], avoidWhen: ['the audience needs to inspect a real interface', 'the point is a simple binary contrast'], inputs: [{ name: 'visual.direction', required: true, description: 'Named inputs, transformations, and outcome.' }, { name: 'narration', description: 'One sentence that follows the flow.' }], keywords: ['how', 'process', 'flow', 'steps', 'system', 'from', 'through', 'automate'] },
  { id: 'comparison-grid', name: 'Comparison grid', purpose: 'Compare several options or dimensions without forcing a winner too early.', useWhen: ['there are 3–6 comparable items', 'trade-offs matter'], avoidWhen: ['there are only two states', 'the viewer needs a linear story'], inputs: [{ name: 'visual.direction', required: true, description: 'Rows/columns and the comparison dimension.' }, { name: 'onScreen', description: 'A concise comparison title.' }], keywords: ['compare', 'options', 'choose', 'features', 'matrix', 'grid', 'versus'] },
  { id: 'quote-proof', name: 'Customer quote', purpose: 'Let a credible human voice carry social proof.', useWhen: ['a short approved quote exists', 'trust matters more than a feature list'], avoidWhen: ['the quote is invented or anonymous without permission', 'the quote needs long context'], inputs: [{ name: 'visual.asset', description: 'Optional approved portrait, logo, or context image.' }, { name: 'onScreen', required: true, description: 'A short approved quote fragment.' }], keywords: ['customer', 'said', 'quote', 'testimonial', 'team', 'trust'] },
  { id: 'feature-bento', name: 'Feature bento', purpose: 'Show a small set of distinct benefits as one composed picture.', useWhen: ['there are 3–5 independent features', 'the video needs a dense product overview'], avoidWhen: ['one feature deserves a deeper demonstration', 'the items are sequential steps'], inputs: [{ name: 'visual.direction', required: true, description: 'The 3–5 feature tiles and their hierarchy.' }, { name: 'onScreen', description: 'A unifying headline.' }], keywords: ['features', 'everything', 'all', 'tools', 'benefits', 'platform'] },
  { id: 'media-moment', name: 'Media moment', purpose: 'Use real footage or photography to establish a place, person, or feeling.', useWhen: ['a supplied visual says more than a diagram', 'brand or physical context matters'], avoidWhen: ['the media is decorative and does not advance the point', 'no rights-cleared media exists'], inputs: [{ name: 'visual.asset', required: true, description: 'A rights-cleared image or video asset.' }, { name: 'onScreen', description: 'Minimal supporting copy.' }], keywords: ['film', 'footage', 'photo', 'people', 'place', 'behind', 'story'] },
  { id: 'decisive-cta', name: 'Decisive CTA', purpose: 'Close on one action and its payoff.', useWhen: ['ending a promotion or product story', 'the desired next step is clear'], avoidWhen: ['the video is educational with no conversion goal', 'multiple competing actions exist'], inputs: [{ name: 'onScreen', required: true, description: 'One action, URL, or short invitation.' }, { name: 'visual.direction', description: 'A visual resolution that echoes the opening.' }], keywords: ['cta', 'try', 'start', 'book', 'learn', 'sign up', 'today', 'close'] },
];

const words = (query: SceneCatalogQuery) => `${query.intent ?? ''} ${query.onScreen ?? ''} ${query.visualDirection ?? ''}`.toLowerCase().match(/[a-z0-9%]+/g) ?? [];

/** Ranks scene shapes with explainable heuristics; scores guide a director, they never force a creative choice. */
export function recommendScenes(query: SceneCatalogQuery = {}, catalog = sceneCatalog): SceneRecommendation[] {
  const tokens = new Set(words(query));
  return catalog.map(scene => {
    const matched = scene.keywords.filter(keyword => tokens.has(keyword) || [...tokens].some(token => keyword.includes(token) || token.includes(keyword)));
    const reasons = matched.map(keyword => `matches “${keyword}”`);
    let score = matched.length * 18;
    if (query.hasMedia && scene.inputs.some(input => input.name === 'visual.asset' && input.required)) { score += 12; reasons.push('has supplied media'); }
    if (!query.hasMedia && scene.id === 'product-ui') score -= 12;
    const missing = scene.inputs.filter(input => input.required && ((input.name === 'visual.asset' && !query.hasMedia) || (input.name === 'onScreen' && !query.onScreen) || (input.name === 'visual.direction' && !query.visualDirection))).map(input => input.name);
    score -= missing.length * 8;
    return { ...scene, score, reasons: reasons.length ? reasons : ['general-purpose narrative fit'], missing };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function sceneCatalogMarkdown(catalog = sceneCatalog): string {
  return catalog.map(scene => `- **${scene.id} — ${scene.name}:** ${scene.purpose}\n  Use when: ${scene.useWhen.join('; ')}. Inputs: ${scene.inputs.filter(input => input.required).map(input => input.name).join(', ') || 'none required'}.`).join('\n');
}
