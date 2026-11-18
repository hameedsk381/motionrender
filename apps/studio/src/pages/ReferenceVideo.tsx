import { useEffect, useState } from 'react';
import { api } from '../api';
import { Button, Field, Notice } from '../ui';

export function ReferenceVideo({ project, onNote }: { project: string; onNote: (note: string) => void }) {
  const [assets, setAssets] = useState<any[]>([]), [asset, setAsset] = useState(''), [result, setResult] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('');
  useEffect(() => { api<any>(`/api/project?id=${encodeURIComponent(project)}`).then(detail => setAssets(detail.assets.filter((item: any) => item.kind === 'video')), failure => setError(failure.message)); }, [project]);
  return <section className="card" style={{ padding: 18 }}><h2 style={{ marginTop: 0 }}>Video reference</h2>
    <p className="sub">Upload a reference in the editor’s Media tab. Extract up to 12 frames to inspect composition, rhythm, and visual progression.</p>
    <Field label="Reference footage"><select value={asset} onChange={e => setAsset(e.target.value)}><option value="">Choose uploaded video</option>{assets.map(item => <option key={item.name}>{item.name}</option>)}</select></Field>
    {error ? <Notice tone="error">{error}</Notice> : null}
    <Button size="sm" disabled={!asset} loading={busy} onClick={async () => { setBusy(true); setError(''); try { setResult(await api('/api/video-plan/reference', { id: project, asset })); } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); } }}>Extract reference frames</Button>
    {result ? <><p className="sub">{result.seconds.toFixed(1)} seconds · evenly sampled frames</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>{result.frames.map((frame: any) => <figure key={frame.url} style={{ margin: 0 }}><img src={frame.url} alt={`Reference at ${frame.seconds.toFixed(1)} seconds`} style={{ width: '100%' }} /><figcaption>{frame.seconds.toFixed(1)}s</figcaption></figure>)}</div></> : null}
    <Field label="What to adopt"><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Describe pacing, palette, framing, and transitions to adopt." /></Field>
    <Button size="sm" disabled={!note.trim()} onClick={() => { onNote(`Reference ${asset || 'notes'}: ${note.trim()}`); setNote(''); }}>Save reference direction</Button>
  </section>;
}
