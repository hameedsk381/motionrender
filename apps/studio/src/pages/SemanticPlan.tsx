import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { editorPath, go } from '../router';
import { ArrowLeftIcon, Badge, Button, CheckIcon, Empty, Field, Notice, Page, PlusIcon, Spinner } from '../ui';
import { SceneModules } from './SceneModules';
import { SceneProps } from './SceneProps';
import { PlanPreview } from './PlanPreview';
import { SceneCatalog } from './SceneCatalog';
import { ReferenceVideo } from './ReferenceVideo';
import { DesignHandoff } from './DesignHandoff';

const scenes = ['kinetic-hook', 'before-after', 'proof-stat', 'workflow', 'comparison-grid', 'feature-bento', 'decisive-cta'];
const clone = <T,>(value: T): T => structuredClone(value);

/** The plan is intentionally written as meaningful beats. The compiler owns coordinates and keyframes. */
export function SemanticPlan({ id }: { id: string }) {
  const [plan, setPlan] = useState<any>(null), [modified, setModified] = useState(0), [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [report, setReport] = useState<any>(null), [dirty, setDirty] = useState(false);
  const [livePreview, setLivePreview] = useState(false);
  useEffect(() => {
    if (!livePreview || !plan) return;
    let active = true;
    const timer = setTimeout(() => {
      api<any>('/api/video-plan/compile', { id, dryRun: true, plan }).then(next => { if (active) { setReport(next); setError(''); } }, failure => { if (active) setError(failure.message); });
    }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [livePreview, plan, id]);
  const load = useCallback(async () => {
    setError('');
    try { const next = await api<any>(`/api/video-plan?id=${encodeURIComponent(id)}`); setState(next); setPlan(next.plan); setModified(next.modified); setDirty(false); }
    catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const change = (apply: (next: any) => void) => { setPlan((current: any) => { const next = clone(current); apply(next); return next; }); setDirty(true); setReport(null); };
  const start = async () => { setBusy('start'); try { const next = await api<any>('/api/video-plan/init', { id }); setState(next); setPlan(next.plan); setModified(next.modified); } catch (e) { setError((e as Error).message); } finally { setBusy(''); } };
  const save = async () => { if (!plan) return; setBusy('save'); setError(''); try { const next = await api<any>('/api/video-plan', { id, plan, baseModified: modified }); setState(next); setPlan(next.plan); setModified(next.modified); setDirty(false); } catch (e) { setError((e as Error).message); } finally { setBusy(''); } };
  const check = async (apply = false) => {
    if (dirty) { setError('Save your changes before checking or building the timeline.'); return; }
    setBusy(apply ? 'compile' : 'check'); setError('');
    try {
      const next = await api<any>('/api/video-plan/compile', { id, dryRun: !apply, baseModified: modified });
      setReport(next); if (apply) go(editorPath(id));
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  if (!state && !error) return <div className="center"><Spinner size={32} /></div>;
  if (!plan) return <div className="center"><Empty title="No semantic plan yet"><p className="sub">Start with the current timeline, then direct it as a brief and a sequence of editable beats.</p><Button variant="primary" loading={busy === 'start'} onClick={() => void start()}>Start semantic plan</Button></Empty>{error ? <Notice tone="error">{error}</Notice> : null}</div>;
  const review = state?.review ?? [], status = state?.status;
  return <Page title="Semantic plan" subtitle="Intent first. The renderer decides the coordinates, timing primitives, and implementation." actions={<><Button size="sm" variant="ghost" icon={<ArrowLeftIcon size={14} />} onClick={() => go(editorPath(id))}>Editor</Button><Button size="sm" variant="primary" icon={<CheckIcon size={14} />} loading={busy === 'save'} disabled={!dirty} onClick={() => void save()}>Save plan</Button></>}>
    {error ? <Notice tone="error" title="Plan action failed">{error}</Notice> : null}
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section className="card" style={{ padding: 22 }}>
        <div className="row"><h2 style={{ margin: 0 }}>Direction</h2><span className="grow" /><Badge tone={dirty ? 'amber' : 'green'}>{dirty ? 'Unsaved' : 'Saved'}</Badge></div>
        <Field label="Video name"><input value={plan.name} onChange={e => change(next => { next.name = e.target.value; })} /></Field>
        <Field label="Creative brief"><textarea rows={3} value={plan.brief.prompt} onChange={e => change(next => { next.brief.prompt = e.target.value; })} /></Field>
        <div className="form-grid"><Field label="Audience"><input value={plan.brief.audience ?? ''} onChange={e => change(next => { next.brief.audience = e.target.value || undefined; })} /></Field><Field label="Goal"><input value={plan.brief.goal ?? ''} onChange={e => change(next => { next.brief.goal = e.target.value || undefined; })} /></Field></div>
        <div className="row" style={{ marginTop: 18 }}><h2 style={{ margin: 0 }}>Beats</h2><span className="grow" /><Button size="sm" icon={<PlusIcon size={14} />} onClick={() => change(next => next.beats.push({ id: `beat-${next.beats.length + 1}`, intent: 'Explain the next idea', durationSeconds: 3, onScreen: '', narration: '', data: [], sourceIds: [], visual: { scene: 'workflow', props: {}, media: 'auto', fit: 'cover', transition: 'cut' } }))}>Add beat</Button></div>
        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>{plan.beats.map((beat: any, index: number) => <article className="card" style={{ padding: 15 }} key={beat.id}><div className="row"><b>{String(index + 1).padStart(2, '0')}</b><input aria-label="Beat id" value={beat.id} onChange={e => change(next => { next.beats[index].id = e.target.value; })} /><span className="grow" /><Button size="sm" variant="ghost" onClick={() => change(next => next.beats.splice(index, 1))} disabled={plan.beats.length === 1}>Remove</Button></div><div className="form-grid" style={{ marginTop: 10 }}><Field label="Intent"><input value={beat.intent} onChange={e => change(next => { next.beats[index].intent = e.target.value; })} /></Field><Field label="Scene pattern"><select value={beat.visual?.scene ?? ''} onChange={e => change(next => { next.beats[index].visual.scene = e.target.value || undefined; })}>{scenes.map(scene => <option key={scene}>{scene}</option>)}</select></Field></div>{beat.storyboard ? <fieldset><legend>Storyboard</legend>
          {([['visible', 'What is on screen?'], ['change', 'What changes?'], ['takeaway', 'What should the viewer understand?']] as const).map(([key, label]) =>
            <Field key={key} label={label}><input maxLength={300} value={beat.storyboard[key]} onChange={e => change(next => { next.beats[index].storyboard[key] = e.target.value; })} /></Field>)}
          <Field label="Review moment (% of beat)"><input type="number" min="0" max="100" step="any" value={Number((100 * beat.storyboard.moment).toFixed(4))} onChange={e => change(next => { next.beats[index].storyboard.moment = Number(e.target.value) / 100; })} /></Field>
          <Button size="sm" variant="ghost" onClick={() => change(next => { delete next.beats[index].storyboard; })}>Remove storyboard</Button>
        </fieldset> : <Button size="sm" variant="ghost" onClick={() => change(next => { next.beats[index].storyboard = { visible: '', change: '', takeaway: '', moment: 0.75 }; })}>Add storyboard</Button>}<Field label="On-screen copy"><input value={beat.onScreen ?? ''} onChange={e => change(next => { next.beats[index].onScreen = e.target.value || undefined; })} /></Field><div className="form-grid"><Field label="Narration"><input value={beat.narration ?? ''} onChange={e => change(next => { next.beats[index].narration = e.target.value || undefined; })} /></Field><Field label="Seconds"><input type="number" min="1" step="0.5" value={beat.durationSeconds} onChange={e => change(next => { next.beats[index].durationSeconds = Number(e.target.value); })} /></Field></div>{state?.assets?.[beat.id]?.length ? <small className="sub">Asset matches: {state.assets[beat.id].map((asset: any) => asset.assetId).join(', ')}</small> : null}</article>)}</div>
      </section>
      <aside style={{ display: 'grid', gap: 14 }}>
        <DesignHandoff design={plan.design} beatIds={plan.beats.map((beat: any) => beat.id)} onChange={design => change(next => { next.design = design; })} />
        <label className="row"><input type="checkbox" checked={livePreview} onChange={event => setLivePreview(event.target.checked)} /> Update preview while editing</label>
        <ReferenceVideo project={id} onNote={note => change(next => { next.comments = [...(next.comments ?? []), { id: crypto.randomUUID(), body: note, createdAt: new Date().toISOString() }]; })} />
        <SceneCatalog beats={plan.beats} onSelect={(beatId, sceneId) => change(next => { const beat = next.beats.find((item: any) => item.id === beatId); beat.visual.scene = sceneId; beat.visual.module = undefined; })} />
        {report?.sceneChanges ? <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Scene changes</h2>
          <p className="sub">Compared with the current timeline. Media file contents are checked when rendering, not in this comparison.</p>
          {report.sceneChanges.scenes.map((scene: any) => <div className="row" key={scene.id} style={{ marginBottom: 8 }}><code>{scene.id}</code><span className="grow" /><Badge tone={scene.status === 'unchanged' ? 'green' : 'amber'}>{scene.status}</Badge></div>)}
          {report.sceneChanges.removed.length ? <p className="sub">Removed: {report.sceneChanges.removed.join(', ')}</p> : null}
        </section> : null}
        {report?.preview ? <PlanPreview detail={report.preview} comments={plan.comments ?? []} onApplyDirection={comment => change(next => {
          const beat = next.beats.find((item: any) => item.id === comment.beatId);
          if (beat) beat.visual.direction = [beat.visual.direction, comment.body].filter(Boolean).join('\n');
        })} onComment={comment => {
          setPlan((current: any) => ({ ...current, comments: [...(current.comments ?? []), comment] })); setDirty(true);
        }} onResolve={commentId => {
          setPlan((current: any) => ({ ...current, comments: current.comments.map((comment: any) => comment.id === commentId ? { ...comment, resolvedAt: new Date().toISOString() } : comment) })); setDirty(true);
        }} /> : null}
        <SceneModules project={id} modules={plan.sceneModules ?? []} onChange={modules => change(next => { next.sceneModules = modules; })} />
        <section className="card" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Scene assignments</h2>
          {plan.beats.map((beat: any, index: number) => <div key={beat.id}><Field label={beat.intent}>
            <select value={beat.visual.module ?? ''} onChange={e => change(next => { next.beats[index].visual.module = e.target.value || undefined; if (e.target.value) next.beats[index].visual.asset = undefined; })}>
              <option value="">Use scene pattern</option>
              {(plan.sceneModules ?? []).map((module: any) => <option key={module.id} value={module.id}>{module.id}</option>)}
            </select>
          </Field>{beat.visual.module ? <SceneProps key={`${beat.id}:${beat.visual.module}`} value={beat.visual.props ?? {}} onChange={props => change(next => { next.beats[index].visual.props = props; })} /> : null}</div>)}
          <p className="sub">Save the plan before checking or building. Custom scenes appear in the editor after building the timeline.</p>
        </section>
        <section className="card" style={{ padding: 18 }}><h2 style={{ marginTop: 0 }}>Review & release</h2><p className="sub">{review.length ? `${review.length} things to resolve before delivery.` : 'No deterministic plan warnings.'}</p>{review.slice(0, 8).map((issue: any, index: number) => <Notice key={index} tone={issue.severity === 'warning' ? 'warn' : 'neutral'}><code>{issue.beatId ?? 'plan'}</code> {issue.message}</Notice>)}<div className="row" style={{ marginTop: 14 }}><Button size="sm" loading={busy === 'check'} onClick={() => void check(false)}>Check compile</Button><Button size="sm" variant="primary" loading={busy === 'compile'} onClick={() => void check(true)}>Build timeline</Button></div>{report ? <p className="sub" style={{ marginBottom: 0 }}>{report.composition.scenes} scenes · {report.notes.join(' ')}</p> : null}</section>
        <section className="card" style={{ padding: 18 }}><h2 style={{ marginTop: 0 }}>Collaboration</h2><p className="sub">{status ? `${status.comments.open} open comments · ${status.approvals.finalApproved ? 'final approved' : 'final approval pending'}` : 'Save the plan to enable shared status.'}</p><Button size="sm" onClick={() => change(next => { const approval = { stage: 'final', approved: true, at: new Date().toISOString(), note: 'Approved in Studio' }; next.approvals = [...(next.approvals ?? []).filter((item: any) => item.stage !== 'final'), approval]; next.approvalHistory = [...(next.approvalHistory ?? []), approval]; })}>Mark final approved</Button></section>
      </aside>
    </div>
  </Page>;
}
