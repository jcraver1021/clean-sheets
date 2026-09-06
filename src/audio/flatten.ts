import { toMidi } from "../model/pitch.ts";
import type { NoteEvent, Pitch, Score } from "../model/score.ts";

export type SoundEvent = {
  partId: string;
  tick: number;
  durationTicks: number;
  midi: number;
};

function samePitches(a: Pitch[], b: Pitch[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (p, i) =>
        p.step === b[i]!.step &&
        p.alter === b[i]!.alter &&
        p.octave === b[i]!.octave,
    )
  );
}

/**
 * Merges a tie chain (`start` → ... → `stop`) into one longer event per
 * chain, so playback hears a single sustained note rather than two attacks.
 */
function resolveTies(events: NoteEvent[]): NoteEvent[] {
  const merged: NoteEvent[] = [];
  for (const event of events) {
    const prev = merged.at(-1);
    const continuesTie =
      prev &&
      (prev.tie === "start" || prev.tie === "both") &&
      prev.tick + prev.durationTicks === event.tick &&
      samePitches(prev.pitches, event.pitches);
    if (continuesTie) {
      prev.durationTicks += event.durationTicks;
      prev.tie = event.tie;
    } else {
      merged.push({ ...event });
    }
  }
  return merged;
}

/**
 * Pure. Expands chords, resolves ties into single longer events, drops
 * rests, sorts by tick. This is the unit-tested one.
 */
export function computeFlatten(score: Score): SoundEvent[] {
  const events: SoundEvent[] = [];
  for (const part of score.parts) {
    for (const event of resolveTies(part.events)) {
      for (const pitch of event.pitches) {
        events.push({
          partId: part.id,
          tick: event.tick,
          durationTicks: event.durationTicks,
          midi: toMidi(pitch),
        });
      }
    }
  }
  return events.sort((a, b) => a.tick - b.tick);
}

/**
 * Memoized wrapper. The caller passes `getRevision()` from edit/history.ts,
 * so this module imports no mutable state and stays test-order-independent.
 */
let cache: { rev: number; out: SoundEvent[] } | null = null;
export function flatten(score: Score, rev: number): SoundEvent[] {
  if (cache?.rev !== rev) cache = { rev, out: computeFlatten(score) };
  return cache.out;
}
