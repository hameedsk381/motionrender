import { useState } from 'react';
import { Button, Field, Notice } from '../ui';
import { SceneSource } from './SceneSource';

export function SceneModules({ project, modules, onChange }: { project: string; modules: any[]; onChange: (modules: any[]) => void }) {
  const [error, setError] = useState('');
  const update = (index: number, patch: any) => onChange(modules.map((module, i) => i === index ? { ...module, ...patch } : module));
  return <section className="card" style={{ padding: 18 }}>
    <h2 style={{ marginTop: 0 }}>Custom scenes</h2>
    <p className="sub">Register a React bundle built with mr build, then select it on a beat. Scene props receive deterministic frame timing and beat copy.</p>
    {error ? <Notice tone="error">{error}</Notice> : null}
    {modules.map((module, index) => <div key={index} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
      <Field label="Module ID"><input value={module.id} onChange={e => update(index, { id: e.target.value })} /></Field>
      <Field label="Project bundle path"><input value={module.src} placeholder="scenes/hero.bundle.js" onChange={e => update(index, { src: e.target.value })} /></Field>
      <Field label="Default props" hint="A JSON object shared by every beat using this scene."><textarea key={JSON.stringify(module.props)} rows={4} defaultValue={JSON.stringify(module.props ?? {}, null, 2)} onBlur={e => { try { const props = JSON.parse(e.target.value); if (!props || Array.isArray(props) || typeof props !== 'object') throw new Error('Props must be an object'); update(index, { props }); setError(''); } catch (failure) { setError((failure as Error).message); } }} /></Field>
      <Button size="sm" variant="ghost" onClick={() => onChange(modules.filter((_, i) => i !== index))}>Remove module</Button>
      <SceneSource project={project} bundle={module.src} onBuilt={src => update(index, { src })} />
    </div>)}
    <Button size="sm" style={{ marginTop: 14 }} onClick={() => { let n = modules.length + 1; while (modules.some(module => module.id === `custom-${n}`)) n++; onChange([...modules, { id: `custom-${n}`, renderer: 'react', src: 'scene.bundle.js', props: {}, assets: [], resolution: 1 }]); }}>Add custom scene</Button>
  </section>;
}
