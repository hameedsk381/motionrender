import { videoPlanSchema, type VideoPlan } from '@ove/schema';
import { createReleaseManifest, type ReleaseOptions } from './release';

export type PlanCollaborationStatus = {
  plan: { id: string; name: string; beats: number };
  comments: { open: number; resolved: number; byBeat: Record<string, number>; items: VideoPlan['comments'] };
  approvals: { current: VideoPlan['approvals']; history: VideoPlan['approvalHistory']; finalApproved: boolean };
  release: ReturnType<typeof createReleaseManifest>;
};

/** One portable shared-status object for a plan review, an approval gate, and a delivery handoff. */
export function planCollaborationStatus(input: VideoPlan | unknown, options: ReleaseOptions = {}): PlanCollaborationStatus {
  const plan = videoPlanSchema.parse(input), open = plan.comments.filter(comment => !comment.resolvedAt), byBeat: Record<string, number> = {};
  for (const comment of open) if (comment.beatId) byBeat[comment.beatId] = (byBeat[comment.beatId] ?? 0) + 1;
  return {
    plan: { id: plan.id, name: plan.name, beats: plan.beats.length },
    comments: { open: open.length, resolved: plan.comments.length - open.length, byBeat, items: plan.comments },
    approvals: { current: plan.approvals, history: plan.approvalHistory, finalApproved: plan.approvals.some(approval => approval.stage === 'final' && approval.approved) },
    release: createReleaseManifest(plan, options),
  };
}
