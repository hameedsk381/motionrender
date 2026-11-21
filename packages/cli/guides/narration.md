# narration: record the lines, cut the video to them

Record each spoken line with `mr voice "A committee reviews it."` (free Edge voices such as `en-US-AriaNeural`; needs internet, no key; `--rate 10` speeds it up). It saves `assets/voice-xxxx.wav` and `assets/voice-xxxx.wav.words.json` (the time of every word) and prints the line's length in frames.

Then cut the video to the speech instead of guessing times: a stop, a number or a picture appears as its own line begins.

```tsx
const voice = [{ src: 'assets/line1.wav', frames: 66 }, { src: 'assets/line2.wav', frames: 75 }];
const starts = voice.reduce<number[]>((list, line, i) => [...list, i === 0 ? 6 : list[i - 1]! + voice[i - 1]!.frames + 10], []);
{voice.map((line, i) => <Sequence key={line.src} from={starts[i]!} durationInFrames={line.frames + 4}><Audio src={line.src} /></Sequence>)}
```

Word-by-word captions: `<Captions words={words} color={ink} highlight={accent} style={{ position: 'absolute', left: 80, top: 1400, width: 760 }} />` in the same `<Sequence>` as the audio, with `import words from './assets/line2.wav.words.json'`.

Keep the music bed near `volume={0.25}`, keep captions inside the safe zones, and make the video as long as the last line plus a beat.
