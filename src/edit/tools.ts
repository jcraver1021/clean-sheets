import { alterFromKeyFifths } from "../model/key.ts";
import { keyAt } from "../model/query.ts";
import type { Pitch, Score, Step } from "../model/score.ts";

/**
 * `null` means derive the accidental from the key signature instead of
 * overriding it.
 */
export type AccidentalOverride = Pitch["alter"] | null;

let activeDurationTicks = 960; // A quarter note at the spec's divisions=960.
let accidentalOverride: AccidentalOverride = null;
let cursorTick: number | null = null; // null = no cursor set yet; Play defaults to tick 0.
let activeVerse = 1; // Which verse the lyric editor reads/writes.

export function setActiveDurationTicks(durationTicks: number): void {
  activeDurationTicks = durationTicks;
}
export function getActiveDurationTicks(): number {
  return activeDurationTicks;
}

export function setAccidentalOverride(override: AccidentalOverride): void {
  accidentalOverride = override;
}
export function getAccidentalOverride(): AccidentalOverride {
  return accidentalOverride;
}

export function setCursorTick(tick: number | null): void {
  cursorTick = tick;
}
export function getCursorTick(): number | null {
  return cursorTick;
}

export function setActiveVerse(verse: number): void {
  activeVerse = verse;
}
export function getActiveVerse(): number {
  return activeVerse;
}

/**
 * The alter a newly-placed `step` should get: the override if set, else
 * the key signature's.
 */
export function resolveAlter(
  score: Score,
  tick: number,
  step: Step,
): Pitch["alter"] {
  return accidentalOverride ?? alterFromKeyFifths(step, keyAt(score, tick));
}
