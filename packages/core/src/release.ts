import { createHash } from 'node:crypto';
import { videoPlanSchema, type VideoPlan } from '@ove/schema';
import { reviewPlanAssets } from './asset-intelligence';
import { compileVideoPlan, reviewVideoPlan } from './plan';

export type ReleaseManifest = {
  version: '1.0'; kind: 'video-release';
  plan: { id: string; name: string; digest: string; finalApproval?: { approved: boolean; at?: string; note?: string } };
  output: { compositionId: string; width: number; height: number; fps: number; durationSeconds: number };
  delivery: { channels: string[]; variables: { name: string; type: string; required: boolean; default?: unknown }[] };
  status: 'ready' | 'blocked'; blockers: { code: string; message: string; beatId?: string }[];
};
export type ReleaseOptions = { channels?: string[]; requireFinalApproval?: boolean };

/** Builds a portable release handoff. It records exactly what is approved and blocks publication on unresolved delivery risks. */
export function createReleaseManifest(input: VideoPlan | unknown, options: ReleaseOptions = {}): ReleaseManifest {
  const plan = videoPlanSchema.parse(input), compiled = compileVideoPlan(plan).composition, blockers: ReleaseManifest['blockers'] = [];
  const final = plan.approvals.find(approval => approval.stage === 'final');
  if (options.requireFinalApproval !== false && !final?.approved) blockers.push({ code: 'final-approval', message: 'Final approval is not recorded. Add a set-approval edit for the final checkpoint before publishing.' });
  for (const issue of reviewVideoPlan(plan)) if (issue.severity === 'warning') blockers.push({ code: issue.code, message: issue.message, ...(issue.beatId ? { beatId: issue.beatId } : {}) });
  for (const issue of reviewPlanAssets(plan)) if (issue.severity === 'warning') blockers.push({ code: issue.code, message: issue.message, beatId: issue.beatId });
  const digest = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return {
    version: '1.0', kind: 'video-release',
    plan: { id: plan.id, name: plan.name, digest, ...(final ? { finalApproval: { approved: final.approved, ...(final.at ? { at: final.at } : {}), ...(final.note ? { note: final.note } : {}) } } : {}) },
    output: { compositionId: compiled.id, width: compiled.width, height: compiled.height, fps: compiled.fps, durationSeconds: Math.round(compiled.durationFrames / compiled.fps * 1000) / 1000 },
    delivery: { channels: [...new Set((options.channels ?? []).filter(Boolean))], variables: Object.entries(plan.variables).map(([name, value]) => ({ name, type: value.type, required: value.default === undefined, ...(value.default === undefined ? {} : { default: value.default }) })) },
    status: blockers.length ? 'blocked' : 'ready', blockers,
  };
}
