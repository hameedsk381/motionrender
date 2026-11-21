import { foldVariants } from './fold';
import { routeVariants } from './route';
import { splitVariants } from './split';

export const explainerVariants: Record<string, string[]> = { fold: [...foldVariants], split: [...splitVariants], route: [...routeVariants], compare: ['split', 'stacked', 'versus', 'halves'], chart: ['columns', 'rows', 'line'], flow: ['funnel', 'chain'], grid: ['board', 'spotlight'], steps: ['list', 'ladder', 'cards', 'bento'], timeline: ['spine', 'zigzag'], stat: ['hero', 'ring', 'stacked', 'bleed'], quote: ['card', 'pull', 'typed', 'bleed'], title: ['poster', 'centred', 'bleed'], closing: ['takeaway', 'poster'], freeform: [], phone: ['handset', 'thread'], hex: [], pile: [], media: ['frame', 'split', 'browser'], code: ['editor', 'typed'], world: [] };
