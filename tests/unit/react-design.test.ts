import { expect, it } from 'vitest';
import { directReactDesign, type AiProvider } from '@ove/ai';
import { explainerKindDocs, explainerVariants } from '@ove/schema';
import { compileExplainer, loadComposition } from '@ove/core';

const storyboard = { visible: 'The subject', change: 'The action plays', takeaway: 'The result', moment: 0.8 };
const providerFor = (answers: unknown[]): AiProvider => ({
  id: 'fixture', model: 'fixture', baseUrl: '',
  chat: async () => {
    expect(answers.length).toBeGreaterThan(0);
    return JSON.stringify(answers.shift());
  },
});
const emptyIntent = { silent: false, singleShot: false, assets: [], actions: [] };

it.each(explainerKindDocs)('directs a $kind scene with its own input contract', async doc => {
  const storyboard = { visible: doc.shows, change: 'Elements appear in order', takeaway: doc.use, moment: 0.6 };
  const actions = {
    route: { kind: 'route', trips: [
      { name: 'First lookup', via: ['Client', 'Cache', 'Storage', 'Cache', 'Client'] },
      { name: 'Second lookup', via: ['Client', 'Cache', 'Client'] },
    ] },
    split: { kind: 'split', origin: 'Source', endpoints: ['Outlet A', 'Outlet B'] },
    fold: { kind: 'fold', inside: 'Field notes', cover: 'Pocket edition' },
  };
  const action = actions[doc.kind as keyof typeof actions];
  const assets = doc.kind === 'media' ? ['assets/city.jpg'] : [];
  const answers = [
    { ...emptyIntent, assets, actions: action ? [action] : [] },
    { topic: 'Test', look: 'paper', scenes: [{ kind: doc.kind, storyboard, action: action ? 1 : undefined }] },
    { ...doc.example, variant: explainerVariants[doc.kind]?.[0] },
  ];
  const brief = `Demonstrate the selected drawing. ${JSON.stringify(doc.example)}`;
  const result = await directReactDesign(providerFor(answers), brief, '16:9');
  expect(result.scenes[0]).toMatchObject({ kind: doc.kind, storyboard });
});

it('requires ordered paths in the storyboard and preserves them through scene expansion', async () => {
  const trips = [
    { name: 'Large expense', via: ['Producer', 'Manager', 'Finance'] },
    { name: 'Petty cash', via: ['Producer', 'Finance'] },
  ];
  const board = { topic: 'Expense paths', look: 'paper' };
  const answers = [
    { ...emptyIntent, actions: [{ kind: 'route', trips }] },
    { ...board, scenes: [{ kind: 'split', action: 1, storyboard }] },
    { ...board, scenes: [{ kind: 'route', action: 1, storyboard }] },
    { kind: 'route', stops: ['Producer', 'Finance'], trips: [trips[0], { ...trips[1], via: trips[0]!.via }], cue: { trip: 'Petty cash', stop: 'Finance', name: 'Direct arrival' } },
  ];
  const result = await directReactDesign(providerFor(answers), 'A large expense goes via the manager and petty cash goes straight to finance.', '9:16', 2);
  expect(result.scenes).toMatchObject([{ kind: 'route', stops: ['Producer', 'Manager', 'Finance'], trips }]);
  expect(answers).toHaveLength(0);
});

it('keeps one fold with the requested printed text and suppresses its soundtrack', async () => {
  const fold = { kind: 'fold', inside: 'Ensemble', cover: 'Night Shift' };
  const board = { topic: 'Theatre programme', look: 'paper' };
  const beat = { kind: 'fold', action: 1, storyboard };
  const answers = [
    { ...emptyIntent, singleShot: true, silent: true, actions: [fold] },
    { ...board, scenes: [beat, beat] },
    { ...board, scenes: [beat] },
    { ...fold, cover: 'Night Shift on front', say: 'An open programme closes' },
  ];
  const script = await directReactDesign(providerFor(answers), 'Make a silent product shot. Close the cast list headed Ensemble to reveal Night Shift.', '9:16', 2);
  expect(script).toMatchObject({ silent: true, music: 'none', scenes: [fold] });
  expect(script.scenes[0]?.say).toBeUndefined();
  for (const reactKinds of [[], ['fold']]) {
    const composition = loadComposition(compileExplainer(script, { reactKinds, audio: [{ src: 'voice.wav', seconds: 3 }] }).composition);
    expect(composition.export.audio).toBeUndefined();
    expect(composition.scenes.flatMap(scene => scene.layers).some(layer => layer.type === 'audio')).toBe(false);
  }
});

it('rejects an unsupplied media scene before filling the drawing', async () => {
  const folder = { kind: 'fold', inside: 'Dinner at seven', cover: 'Mira & Dev' };
  const board = { topic: 'Invitation', look: 'paper' };
  const answers = [
    { ...emptyIntent, actions: [folder] },
    { ...board, scenes: [{ kind: 'media', storyboard }, { kind: 'fold', action: 1, storyboard }] },
    { ...board, scenes: [{ kind: 'fold', action: 1, storyboard }] },
    { ...folder, artwork: 'print', direction: 'right-to-left' },
  ];
  const result = await directReactDesign(providerFor(answers), 'Close an invitation showing Dinner at seven inside and Mira & Dev on the cover.', '9:16', 2);
  expect(result.scenes).toMatchObject([folder]);
  expect(answers).toHaveLength(0);
});

it('retries the closing scene with field paths and accepts a single wrapped replacement', async () => {
  const required = { kind: 'closing', title: 'Skipping Market saves time' };
  const answers = [
    emptyIntent,
    { topic: 'Express train', look: 'paper', scenes: [{ kind: 'closing', storyboard }] },
    { kind: 'closing', change: 'Summarize the trip' },
    { ...required, points: ['Central', 'Market', 'Harbor', 'Express'] },
    { scene: required },
  ];
  const provider = providerFor(answers);
  const result = await directReactDesign({
    ...provider,
    chat: (messages, options) => {
      if (answers.length === 2) expect(messages.at(-1)?.content).toContain('\ntitle:');
      if (answers.length === 1) expect(messages.at(-1)?.content).toContain('\npoints:');
      return provider.chat(messages, options);
    },
  }, 'The express reaches Harbor sooner by skipping Market.', '9:16');
  expect(result.scenes).toMatchObject([required]);
});

it('retries invented time savings in both the storyboard and spoken copy', async () => {
  const board = { topic: 'Express train', look: 'paper' };
  const required = { kind: 'closing', title: 'Skipping Market saves time' };
  const answers = [
    emptyIntent,
    { ...board, scenes: [{ kind: 'closing', storyboard: { ...storyboard, takeaway: 'The express saves 5 min' } }] },
    { ...board, scenes: [{ kind: 'closing', storyboard }] },
    { ...required, say: 'The express saves five minutes' },
    { ...required, say: 'The express skips Market' },
  ];
  const result = await directReactDesign(providerFor(answers), 'The express reaches Harbor sooner by skipping Market.', '9:16');
  expect(result.scenes).toMatchObject([{ ...required, say: 'The express skips Market' }]);
  expect(answers).toHaveLength(0);
});

it('allows numeric copy with an equivalent supplied unit and spelling', async () => {
  const stat = { kind: 'stat', value: '5 min', label: 'Express trip', say: 'The express takes five minutes.' };
  const answers = [
    emptyIntent,
    { topic: 'Express trip', look: 'paper', scenes: [{ kind: 'stat', storyboard }] },
    stat,
  ];
  const result = await directReactDesign(providerFor(answers), 'The express takes five minutes.', '9:16');
  expect(result.scenes).toMatchObject([stat]);
});

it('replans a media beat when the file named in the brief is unavailable', async () => {
  const asset = 'assets/invitation.jpg';
  const board = { topic: 'Invitation', look: 'paper' };
  const title = { kind: 'title', lines: ['Mira & Dev'] };
  const answers = [
    { ...emptyIntent, assets: [asset] },
    { ...board, scenes: [{ kind: 'media', storyboard }] },
    { ...board, scenes: [{ kind: 'title', storyboard }] },
    title,
  ];
  const result = await directReactDesign(providerFor(answers), `Use ${asset} to introduce Mira & Dev.`, '9:16', 2, {
    mediaAvailable: src => { expect(src).toBe(asset); return false; },
  });
  expect(result.scenes).toMatchObject([title]);
  expect(answers).toHaveLength(0);
});
