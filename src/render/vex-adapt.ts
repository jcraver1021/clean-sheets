import { Stem } from "vexflow";
import { fromDiatonic } from "../model/pitch.ts";
import type { Pitch } from "../model/score.ts";

const ALTER_TO_ACCIDENTAL: Record<Pitch["alter"], string> = {
  [-2]: "bb",
  [-1]: "b",
  0: "",
  1: "#",
  2: "##",
};

/**
 * Converts a diatonic index and accidental to a VexFlow key, e.g.
 * `toVexKey(38, 1)` -> `"f#/5"`.
 */
export function toVexKey(diatonic: number, alter: Pitch["alter"]): string {
  const { step, octave } = fromDiatonic(diatonic);
  return `${step.toLowerCase()}${ALTER_TO_ACCIDENTAL[alter]}/${octave}`;
}

export type VexDuration = { duration: string; dots: number };

// VexFlow base duration codes, whole note to 256th (see Tables.durations).
const BASE_DURATION_CODES = [1, 2, 4, 8, 16, 32, 64, 128, 256] as const;
const MAX_DOTS = 3;

/**
 * Converts ticks to a VexFlow duration code + dot count, mirroring
 * `Note.parseNoteStruct`'s tick math (base ticks, then add half the remainder
 * per dot). No tuplet support — no exact match exists for those.
 */
export function toVexDuration(
  durationTicks: number,
  divisions: number,
): VexDuration {
  const wholeNoteTicks = divisions * 4;
  for (const code of BASE_DURATION_CODES) {
    const baseTicks = wholeNoteTicks / code;
    if (!Number.isInteger(baseTicks)) continue;

    let total = baseTicks;
    let dotValue = baseTicks;
    for (let dots = 0; dots <= MAX_DOTS; dots++) {
      if (dots > 0) {
        dotValue /= 2;
        if (!Number.isInteger(dotValue)) break;
        total += dotValue;
      }
      if (total === durationTicks) return { duration: String(code), dots };
    }
  }
  throw new Error(
    `durationTicks ${durationTicks} has no exact VexFlow duration (tuplets aren't supported yet)`,
  );
}

/**
 * Stem direction by position in a stave's voices, not part identity — part
 * count isn't fixed, so "soprano up / alto down" generalizes to "first
 * voice up, alternating." A single-voice stave falls back to VexFlow's
 * automatic pitch-based stemming.
 */
export function stemFor(
  voiceCountOnStave: number,
  indexInStave: number,
): number | undefined {
  if (voiceCountOnStave <= 1) return undefined;
  return indexInStave % 2 === 0 ? Stem.UP : Stem.DOWN;
}

const MAJOR_KEY_BY_FIFTHS: Record<number, string> = {
  [-7]: "Cb",
  [-6]: "Gb",
  [-5]: "Db",
  [-4]: "Ab",
  [-3]: "Eb",
  [-2]: "Bb",
  [-1]: "F",
  0: "C",
  1: "G",
  2: "D",
  3: "A",
  4: "E",
  5: "B",
  6: "F#",
  7: "C#",
};

/**
 * Converts MusicXML-style `keyFifths` (-7..7) to a VexFlow key-signature name,
 * e.g. `2` -> `"D"`.
 */
export function toVexKeySignature(keyFifths: number): string {
  const key = MAJOR_KEY_BY_FIFTHS[keyFifths];
  if (!key) throw new Error(`keyFifths ${keyFifths} is out of the -7..7 range`);
  return key;
}
