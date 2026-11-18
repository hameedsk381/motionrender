import { useEffect, useState } from 'react';
import { api } from '../api';
import { Button, Field, Notice } from '../ui';

const starter = `import { AbsoluteFill, useCurrentFrame } from 'motionrender/react';
export const config = { id: 'custom', width: 1920, height: 1080, fps: 30, durationInFrames: 90 };
export default function Scene({ beat }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: '#10242a', color: '#fff', justifyContent: 'center', alignItems: 'center', fontSize: 80 }}>
    <div style={{ opacity: Math.min(1, frame / 15) }}>{beat?.onScreen || 'Your story'}</div>
  </AbsoluteFill>;
}`;

export function SceneSource({ project, bundle, onBuilt }: { project: string; bundle: string; onBuilt: (src: string) => void }) {
  const [source, setSource] = useState(starter), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!/^scenes\/[a-f0-9]{20}\/scene\.bundle\.js$/.test(bundle)) return;
    let active = true;
    fetch(`/files/${encodeURIComponent(project)}/${bundle.replace('scene.bundle.js', 'scene.tsx')}`).then(async response => { if (!response.ok) throw new Error('Could not reload scene source'); const text = await response.text(); if (active) setSource(text); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [project, bundle]);
  return <details style={{ marginTop: 12 }}><summary>Edit React source</summary>
    <Field label="Scene source" hint="Local Studio builds trusted source on your machine. Each build gets a versioned bundle path."><textarea rows={15} spellCheck={false} value={source} onChange={e => setSource(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} /></Field>
    {error ? <Notice tone="error">{error}</Notice> : null}
    <Button size="sm" loading={busy} onClick={async () => { setBusy(true); setError(''); try { const result = await api<{ src: string }>('/api/video-plan/build-scene', { id: project, source }); onBuilt(result.src); } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); } }}>Build scene source</Button>
  </details>;
}
