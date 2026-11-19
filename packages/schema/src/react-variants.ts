import { foldVariants } from './fold';
import { routeVariants } from './route';
import { splitVariants } from './split';

export const explainerVariants: Record<string, string[]> = { fold: [...foldVariants], split: [...splitVariants], route: [...routeVariants], compare: ['split', 'stacked', 'versus'], chart: ['columns', 'rows', 'line'], flow: ['funnel', 'chain'], grid: ['board', 'spotlight'], steps: ['list', 'ladder', 'cards', 'bento'], timeline: ['spine', 'zigzag'], stat: ['hero', 'ring', 'stacked'], quote: ['card', 'pull', 'typed'], title: ['poster', 'centred'], closing: ['takeaway', 'poster'], freeform: [], phone: ['handset', 'thread'], hex: [], pile: [], media: ['frame', 'split', 'browser'], code: ['editor', 'typed'], world: [] };
