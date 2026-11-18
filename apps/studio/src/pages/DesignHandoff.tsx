import type { VideoPlan } from '@ove/contracts';
import { Button, Field } from '../ui';

type Design = NonNullable<VideoPlan['design']>;
export function DesignHandoff({ design, beatIds, onChange }: { design?: Design; beatIds: string[]; onChange: (design: Design | undefined) => void }) {
  if (!design) return <section className="card" style={{ padding: 18 }}><h2>Design direction</h2><p className="sub">Define the visual concept and narrative acts before refining scenes.</p><Button size="sm" onClick={() => onChange({ concept: 'Describe the central visual idea', visualMetaphor: 'Describe the relationship the viewer sees', motif: 'Name a recurring form from the subject', typography: { display: 'Inter', body: 'Inter', treatment: 'Describe the type hierarchy' }, motion: 'Describe how the idea develops in motion', avoid: [], acts: [{ id: 'main', purpose: 'Develop the central idea', beatIds, field: '#ffffff', ink: '#142838', accent: '#005ca8' }] })}>Add design direction</Button></section>;
  const patch = (changes: Partial<Design>) => onChange({ ...design, ...changes });
  return <section className="card" style={{ padding: 18 }}><h2>Design direction</h2>
    {(['concept', 'visualMetaphor', 'motif', 'motion'] as const).map(key => <Field key={key} label={{ concept: 'Concept', visualMetaphor: 'Visual metaphor', motif: 'Recurring motif', motion: 'Motion language' }[key]}><textarea rows={2} value={design[key]} onChange={event => patch({ [key]: event.target.value })} /></Field>)}
    <Field label="Display typeface"><select value={design.typography.display} onChange={event => patch({ typography: { ...design.typography, display: event.target.value } })}>{['Inter', 'Archivo', 'Fraunces', 'Space Grotesk'].map(font => <option key={font}>{font}</option>)}</select></Field>
    <Field label="Typography treatment"><textarea rows={2} value={design.typography.treatment} onChange={event => patch({ typography: { ...design.typography, treatment: event.target.value } })} /></Field>
    <h3>Narrative acts</h3>
    {design.acts.map((act, index) => <div key={index} style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <Field label="Act purpose"><input value={act.purpose} onChange={event => patch({ acts: design.acts.map((item, i) => i === index ? { ...item, purpose: event.target.value } : item) })} /></Field>
      <Field label="Beat IDs" hint={`Assign each beat once: ${beatIds.join(', ')}`}><input value={act.beatIds.join(', ')} onChange={event => patch({ acts: design.acts.map((item, i) => i === index ? { ...item, beatIds: event.target.value.split(',').map(value => value.trim()).filter(Boolean) } : item) })} /></Field>
      {(['field', 'ink', 'accent'] as const).map(key => <Field key={key} label={key}><input type="color" value={act[key] ?? '#005ca8'} onChange={event => patch({ acts: design.acts.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item) })} /></Field>)}
      <Button size="sm" variant="ghost" disabled={design.acts.length === 1} onClick={() => patch({ acts: design.acts.filter((_, i) => i !== index) })}>Remove act</Button>
    </div>)}
    <Button size="sm" onClick={() => { let n = design.acts.length + 1; while (design.acts.some(act => act.id === `act-${n}`)) n++; patch({ acts: [...design.acts, { id: `act-${n}`, purpose: 'Describe the narrative turn', beatIds: [], field: '#142838', ink: '#ffffff' }] }); }}>Add narrative act</Button>
  </section>;
}
