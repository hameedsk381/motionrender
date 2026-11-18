import { useEffect, useState } from 'react';
import { api } from '../api';
import { Button, Field, Notice } from '../ui';

export function SceneCatalog({ beats, onSelect }: { beats: any[]; onSelect: (beatId: string, sceneId: string) => void }) {
  const [scenes, setScenes] = useState<any[]>([]), [query, setQuery] = useState(''), [beat, setBeat] = useState(beats[0]?.id ?? ''), [error, setError] = useState('');
  useEffect(() => { api<any>('/api/video-plan/catalog').then(result => setScenes(result.scenes), failure => setError(failure.message)); }, []);
  return <section className="card" style={{ padding: 18 }}><h2 style={{ marginTop: 0 }}>Scene catalog</h2>
    {error ? <Notice tone="error">{error}</Notice> : null}
    <Field label="Search patterns"><input value={query} onChange={e => setQuery(e.target.value)} /></Field>
    <Field label="Target beat"><select value={beat} onChange={e => setBeat(e.target.value)}>{beats.map(item => <option key={item.id} value={item.id}>{item.intent}</option>)}</select></Field>
    <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 16 }}>{scenes.filter(scene => `${scene.name} ${scene.purpose} ${scene.keywords.join(' ')}`.toLowerCase().includes(query.toLowerCase())).map(scene => <article key={scene.id}><b>{scene.name}</b><p className="sub">{scene.purpose}</p><small>Needs: {scene.inputs.filter((input: any) => input.required).map((input: any) => input.name).join(', ') || 'No required inputs'}</small><div style={{ marginTop: 8 }}><Button size="sm" disabled={!beats.some(item => item.id === beat)} onClick={() => onSelect(beat, scene.id)}>Use pattern</Button></div></article>)}</div>
  </section>;
}
