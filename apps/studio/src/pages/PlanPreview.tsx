import { useRef, useState } from 'react';
import type { Detail } from '../api';
import { PlayerView, type PlayerHandle } from '../Player';
import { Button, Field } from '../ui';

export function PlanPreview({ detail, comments, onComment, onResolve, onApplyDirection }: {
  detail: Detail;
  comments: any[];
  onComment: (comment: any) => void;
  onResolve: (id: string) => void;
  onApplyDirection: (comment: any) => void;
}) {
  const player = useRef<PlayerHandle>(null);
  const [frame, setFrame] = useState(0), [body, setBody] = useState('');
  const scene = detail.scenes.find(item => frame >= item.startFrame && frame < item.startFrame + item.durationFrames);
  return <section className="card" style={{ padding: 18 }}>
    <h2 style={{ marginTop: 0 }}>Plan preview</h2>
    <PlayerView ref={player} detail={detail} startFrame={0} onFrame={setFrame} />
    <Field label={`Feedback at frame ${frame} · ${scene?.name ?? 'Video'}`}>
      <textarea rows={3} value={body} onChange={event => setBody(event.target.value)} placeholder="Describe the visual change you want." />
    </Field>
    <Button size="sm" disabled={!body.trim()} onClick={() => {
      onComment({ id: crypto.randomUUID(), beatId: scene?.beat ?? scene?.id, frame, body: body.trim(), createdAt: new Date().toISOString() });
      setBody('');
    }}>Add frame feedback</Button>
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>{comments.filter(comment => !comment.resolvedAt).map(comment => <article key={comment.id}>
      <Button size="sm" variant="ghost" onClick={() => player.current?.seek(comment.frame ?? 0)}>{comment.beatId ?? 'Video'} · frame {comment.frame ?? 0}</Button>
      <p style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</p>
      <Button size="sm" onClick={() => onResolve(comment.id)}>Resolve feedback</Button>
      {comment.beatId ? <Button size="sm" variant="ghost" onClick={() => onApplyDirection(comment)}>Use as visual direction</Button> : null}
    </article>)}</div>
  </section>;
}
