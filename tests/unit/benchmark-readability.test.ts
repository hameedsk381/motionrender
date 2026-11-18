import { expect, it } from 'vitest';
import { briefs, scoreRun } from '../../scripts/eval-briefs';

it.each(['read-time', 'safe-zone', 'caption-speed', 'dom-clip', 'contrast'])('does not pass readability with %s regardless of message wording', code => {
  const score = scoreRun({ id: 'sample', label: 'sample', frames: 360, width: 1920, height: 1080, reviewErrors: 0, reviewWarnings: [code], reviewMessages: ['A newly worded finding'] }, briefs.find(brief => brief.id === 'explainer')!);
  expect(score.checks['copy readable']?.pass).toBe(false);
  expect(score.passed).toBe(false);
});
