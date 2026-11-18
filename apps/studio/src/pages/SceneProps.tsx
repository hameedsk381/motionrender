import { useState } from 'react';
import { Field } from '../ui';

/** Keep unfinished JSON local so typing cannot corrupt a beat's last valid props. */
export function SceneProps({ value, onChange }: { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState('');
  return <Field label="Beat props" hint={error || 'Overrides the module defaults for this beat.'}>
    <textarea rows={5} aria-invalid={!!error} value={text} onChange={event => {
      const input = event.target.value;
      setText(input);
      try {
        const parsed = JSON.parse(input);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Enter a JSON object.');
        setError('');
        onChange(parsed);
      } catch { setError('Enter a valid JSON object before saving these props.'); }
    }} />
  </Field>;
}
