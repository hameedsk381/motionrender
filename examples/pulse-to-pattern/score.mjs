import { writeFile } from 'node:fs/promises';

const rate = 48000;
const count = 12 * rate;
const wave = Buffer.alloc(44 + count * 2);
wave.write('RIFF', 0);
wave.writeUInt32LE(wave.length - 8, 4);
wave.write('WAVEfmt ', 8);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(rate, 24);
wave.writeUInt32LE(rate * 2, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write('data', 36);
wave.writeUInt32LE(count * 2, 40);

const tone = (hz, time) => Math.sin(2 * Math.PI * hz * time);
const notes = [110, 130.81, 146.83, 164.81, 146.83, 130.81];
for (let i = 0; i < count; i++) {
  const beat = Math.floor(i / (rate / 2));
  const t = (i % (rate / 2)) / rate;
  const accent = [0, 4, 12, 20].includes(beat);
  const envelope = Math.min(1, t * 420, (.5 - t) * 220);
  const bass = tone(notes[Math.floor(beat / 4)], t) * Math.exp(-8 * t);
  const kick = Math.sin(2 * Math.PI * (44 * t + 2 * (1 - Math.exp(-38 * t)))) * Math.exp(-22 * t);
  const tick = tone(2267, t) * Math.exp(-96 * t);
  const value = envelope * (.20 * bass + (accent ? .58 : .32) * kick + (beat % 2 ? .12 : .065) * tick);
  wave.writeInt16LE(Math.round(value * 31000), 44 + 2 * i);
}
await writeFile(new URL('score.wav', import.meta.url), wave);
