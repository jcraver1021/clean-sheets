import type { Pitch, Step } from "./score";

const STEP_SEMITONES: Record<Step, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const STEP_INDEX: Record<Step, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};
const INDEX_STEP: Step[] = ["C", "D", "E", "F", "G", "A", "B"];

export function toMidi(pitch: Pitch): number {
  return 12 * (pitch.octave + 1) + STEP_SEMITONES[pitch.step] + pitch.alter;
}

/**
 * The diatonic index — maps to staff position.
 */
export function toDiatonic(pitch: Pitch): number {
  return pitch.octave * 7 + STEP_INDEX[pitch.step];
}

/**
 * Inverse of `toDiatonic`. MIDI→spelling is lossy (needs key context), so
 * this takes a diatonic index only, never MIDI.
 */
export function fromDiatonic(diatonic: number): Omit<Pitch, "alter"> {
  return {
    step: INDEX_STEP[((diatonic % 7) + 7) % 7],
    octave: Math.floor(diatonic / 7),
  };
}
