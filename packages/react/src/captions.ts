// Spoken-word captions for a code-first video: a few words at a time, the word being said picked out. Give it the word timings `mr voice` writes beside a recording
// (an array of { text, start, end } in seconds) and place it where the video wants it; put it in the same <Sequence> as the <Audio> so the clock starts together.
import { createElement as h, type CSSProperties, type ReactElement } from 'react';
import { useCurrentFrame, useVideoConfig } from './index';

export type CaptionWordTiming = { text: string; start: number; end: number };
export type CaptionsProps = {
  words: CaptionWordTiming[];
  /** Longest line, in words (default 5). */ maxWords?: number;
  /** Colour of the words not yet said (default the text colour at half strength). */ upcoming?: string;
  /** Colour of the word being said and the ones before it. */ color?: string;
  /** Colour of the word being said (default the same as `color`, bolder). */ highlight?: string;
  /** Font size in pixels (default 54). */ size?: number;
  style?: CSSProperties;
};

/** Words grouped into short lines that break at the end of a sentence, a pause, or `maxWords`. */
export function captionLines(words: CaptionWordTiming[], maxWords = 5): { start: number; end: number; words: CaptionWordTiming[] }[] {
  const lines: { start: number; end: number; words: CaptionWordTiming[] }[] = [];
  let line: CaptionWordTiming[] = [];
  const flush = () => { if (line.length) lines.push({ start: line[0]!.start, end: line[line.length - 1]!.end, words: line }); line = []; };
  words.forEach((word, i) => {
    line.push(word);
    const next = words[i + 1];
    if (!next || /[.!?]["')\]]?$/.test(word.text) || (/[,;:]["')\]]?$/.test(word.text) && line.length >= 3) || next.start - word.end > 0.35 || line.length >= maxWords) flush();
  });
  return lines;
}

/** The line being said (or just said, for 0.3 s), each word coloured by whether it is to come, being said or said. Pure in the frame like the rest of the kit. */
export function Captions({ words, maxWords = 5, upcoming = 'rgba(127,127,127,0.65)', color = '#111111', highlight, size = 54, style }: CaptionsProps): ReactElement | null {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps;
  const lines = captionLines(words, maxWords);
  const line = lines.find(l => t >= l.start && t < l.end) ?? [...lines].reverse().find(l => l.end <= t && t - l.end < 0.3);
  if (!line) return null;
  const said = line.words.reduce((at, word, i) => (word.start <= t ? i : at), -1);
  return h('div', { style: { fontSize: size, fontWeight: 700, lineHeight: 1.25, textAlign: 'center', ...style } },
    line.words.map((word, i) => h('span', { key: i, style: { color: i < said ? color : i === said ? (highlight ?? color) : upcoming, fontWeight: i === said ? 800 : 700 } }, (i ? ' ' : '') + word.text)));
}
