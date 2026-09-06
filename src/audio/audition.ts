import * as Tone from "tone";
import type { Score } from "../model/score.ts";
import { isAudible, partVoices } from "./engine.ts";
import { flatten } from "./flatten.ts";
import type { SoundEvent } from "./flatten.ts";

/**
 * Pure, over `SoundEvent[]` rather than `Score`, so it's trivially
 * unit-testable. The interval is half-open — a note ending exactly at
 * `tick` does not sound.
 */
export function soundingAt(events: SoundEvent[], tick: number): SoundEvent[] {
  return events.filter(
    (event) => event.tick <= tick && tick < event.tick + event.durationTicks,
  );
}

/**
 * Mode B: audition the chord sounding at `tick`. Deliberately doesn't touch
 * Tone's Transport — this is a one-shot query, not playback (that's Mode A).
 * `style: "roll"` staggers the notes bottom-up so each voice is audible in
 * turn, for checking voice leading rather than just the harmony.
 */
export async function audition(
  score: Score,
  rev: number,
  tick: number,
  style: "block" | "roll" = "block",
  holdSec = 1.5,
): Promise<void> {
  await Tone.start();
  const chord = soundingAt(flatten(score, rev), tick).sort(
    (a, b) => a.midi - b.midi,
  );
  const now = Tone.now();
  chord.forEach((event, i) => {
    if (!isAudible(event.partId)) return;
    const at = now + (style === "roll" ? i * 0.08 : 0);
    partVoices
      .get(event.partId)!
      .synth.triggerAttackRelease(
        Tone.Frequency(event.midi, "midi").toFrequency(),
        holdSec,
        at,
      );
  });
}
