import type { Step } from "./score.ts";

// Standard order sharps/flats are added in a major key signature.
const SHARP_ORDER: Step[] = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER: Step[] = ["B", "E", "A", "D", "G", "C", "F"];

/**
 * The accidental `step` takes on in a major key with `keyFifths` sharps
 * (positive) or flats (negative), per the standard sharp/flat order.
 */
export function alterFromKeyFifths(step: Step, keyFifths: number): -1 | 0 | 1 {
  if (keyFifths > 0)
    return SHARP_ORDER.slice(0, keyFifths).includes(step) ? 1 : 0;
  if (keyFifths < 0)
    return FLAT_ORDER.slice(0, -keyFifths).includes(step) ? -1 : 0;
  return 0;
}
