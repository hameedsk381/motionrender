import { assetNotes, type Asset, type VideoPlan } from '@ove/schema';
import { sceneCatalog } from './scene-catalog';

export type AssetRecommendation = { assetId: string; score: number; reasons: string[]; usable: boolean };
export type AssetPlanIssue = { severity: 'warning' | 'info'; code: string; beatId: string; message: string };

const tokens = (...values: (string | undefined)[]) => new Set(values.join(' ').toLowerCase().match(/[a-z0-9]+/g) ?? []);
const assetWords = (asset: Asset) => {
  const meta = asset.metadata ?? {}, tags = Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  return tokens(asset.id, asset.src, typeof meta.title === 'string' ? meta.title : undefined, typeof meta.description === 'string' ? meta.description : undefined, ...tags);
};
const visualType = (asset: Asset) => asset.type === 'image' || asset.type === 'video' || asset.type === 'svg';

/** Ranks declared assets for a beat without changing the plan. Scores are deliberately explainable and conservative about rights/status. */
export function recommendPlanAssets(input: VideoPlan | unknown, beatId: string): AssetRecommendation[] {
  const plan = (input as VideoPlan), beat = plan.beats.find(candidate => candidate.id === beatId);
  if (!beat) throw new Error(`No beat named "${beatId}" exists in this video plan`);
  const wanted = tokens(beat.intent, beat.onScreen, beat.visual.direction), scene = beat.visual.scene ? sceneCatalog.find(entry => entry.id === beat.visual.scene) : undefined;
  return plan.assets.map(asset => {
    const reasons: string[] = [], words = assetWords(asset); let score = 0;
    if (visualType(asset)) { score += 35; reasons.push('visual asset'); } else { score -= 50; reasons.push('not visual media'); }
    if (beat.visual.media === 'video') { if (asset.type === 'video') { score += 30; reasons.push('matches requested video'); } else score -= 35; }
    if (beat.visual.media === 'image') { if (asset.type === 'image' || asset.type === 'svg') { score += 30; reasons.push('matches requested image'); } else score -= 35; }
    if (scene?.inputs.some(field => field.name === 'visual.asset' && field.required) && visualType(asset)) { score += 15; reasons.push(`fits ${scene.id}`); }
    const matched = [...wanted].filter(word => words.has(word)); if (matched.length) { score += Math.min(24, matched.length * 8); reasons.push(`matches ${matched.slice(0, 3).join(', ')}`); }
    if (asset.status === 'approved') { score += 20; reasons.push('approved'); }
    if (asset.status === 'candidate') { score += 4; reasons.push('awaits approval'); }
    if (asset.status === 'rejected' || asset.status === 'superseded') { score -= 100; reasons.push(asset.status); }
    if (asset.rights?.commercialUse === 'restricted') { score -= 100; reasons.push('commercial use restricted'); }
    if (asset.rights?.commercialUse === 'unknown') { score -= 8; reasons.push('rights unrecorded'); }
    return { assetId: asset.id, score, reasons, usable: visualType(asset) && asset.status !== 'rejected' && asset.status !== 'superseded' && asset.rights?.commercialUse !== 'restricted' };
  }).sort((a, b) => b.score - a.score || a.assetId.localeCompare(b.assetId));
}

/** Checks that a plan's selected assets are safe and meaningful enough to take into draft production. */
export function reviewPlanAssets(input: VideoPlan | unknown): AssetPlanIssue[] {
  const plan = input as VideoPlan, issues: AssetPlanIssue[] = [], assets = new Map(plan.assets.map(asset => [asset.id, asset]));
  for (const beat of plan.beats) {
    const id = beat.visual.asset, selected = id ? assets.get(id) : undefined;
    if (id && !selected && !/^https?:\/\//.test(id) && !/^[./]/.test(id)) issues.push({ severity: 'warning', code: 'asset-undeclared', beatId: beat.id, message: `Beat "${beat.id}" names asset "${id}" but it is not declared in plan.assets.` });
    if (!selected) continue;
    if (!visualType(selected)) issues.push({ severity: 'warning', code: 'asset-not-visual', beatId: beat.id, message: `Beat "${beat.id}" uses "${selected.id}", which is ${selected.type}, not visual media.` });
    if (selected.status === 'rejected' || selected.status === 'superseded') issues.push({ severity: 'warning', code: 'asset-unavailable', beatId: beat.id, message: `Beat "${beat.id}" uses ${selected.status} asset "${selected.id}".` });
    for (const note of assetNotes([selected])) if (note.severity === 'warning') issues.push({ severity: 'warning', code: note.code, beatId: beat.id, message: note.message });
    const scene = beat.visual.scene ? sceneCatalog.find(entry => entry.id === beat.visual.scene) : undefined;
    if (scene?.inputs.some(field => field.name === 'visual.asset' && field.required) && !visualType(selected)) issues.push({ severity: 'warning', code: 'scene-asset-contract', beatId: beat.id, message: `Scene "${scene.id}" needs visual media, but "${selected.id}" is ${selected.type}.` });
  }
  return issues;
}
