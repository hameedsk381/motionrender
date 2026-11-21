// The motion assertions beside a video: video.tsx -> video.motion.json, explainer.json -> explainer.motion.json, composition.json -> composition.motion.json.
// `mr make` and `mr review` read it when it is there and check it on the real frames.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parseMotionAssertions, type MotionAssertion } from '@ove/core';

/** Where a video's motion assertions live. */
export const motionFileFor = (source: string): string => { const path = resolve(source), ext = extname(path); return `${ext ? path.slice(0, -ext.length) : path}.motion.json`; };

/** The assertions beside `source`, or undefined when it has none. A file that cannot be read says what is wrong with it. */
export async function loadMotionAssertions(source: string, explicit?: string): Promise<MotionAssertion[] | undefined> {
  const file = explicit ? resolve(explicit) : motionFileFor(source);
  if (!existsSync(file)) { if (explicit) throw new Error(`${file} does not exist`); return undefined; }
  let raw: unknown;
  try { raw = JSON.parse((await readFile(file, 'utf8')).replace(/^﻿/, '')); } catch (error) { throw new Error(`${file} is not valid JSON: ${(error as Error).message}`); }
  return parseMotionAssertions(raw);
}
