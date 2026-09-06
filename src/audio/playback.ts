import * as Tone from "tone";
import type { Score } from "../model/score.ts";
import { secondsToTick, tickToSeconds } from "../model/tempo.ts";
import { isAudible, partVoices } from "./engine.ts";
import { flatten } from "./flatten.ts";

let currentPart: Tone.Part | null = null;
let originSec = 0; // tickToSeconds(cursorTick) — the playhead needs this.

export function isPlaying(): boolean {
  return currentPart !== null;
}

/**
 * Mode A: plays `score` forward from `cursorTick`. Includes notes already
 * sounding there — a held note truncated at the cursor, not just ones
 * starting at or after it — which is the musically correct behavior for
 * dropping into a phrase mid-measure.
 */
export async function playFrom(
  score: Score,
  rev: number,
  cursorTick: number,
): Promise<void> {
  await Tone.start();
  stop(); // Always tear down first, or a second Play layers onto the first.
  const transport = Tone.getTransport();
  originSec = tickToSeconds(score, cursorTick);

  const events = flatten(score, rev)
    .filter((event) => event.tick + event.durationTicks > cursorTick)
    .map((event) => {
      const start = Math.max(event.tick, cursorTick);
      return {
        time: tickToSeconds(score, start) - originSec,
        midi: event.midi,
        partId: event.partId,
        durationSec:
          tickToSeconds(score, event.tick + event.durationTicks) -
          tickToSeconds(score, start),
      };
    });

  currentPart = new Tone.Part(
    (time, event: (typeof events)[number]) => {
      if (!isAudible(event.partId)) return;
      partVoices
        .get(event.partId)!
        .synth.triggerAttackRelease(
          Tone.Frequency(event.midi, "midi").toFrequency(),
          event.durationSec,
          time,
        );
    },
    events.map((event) => [event.time, event] as [number, typeof event]),
  ).start(0);

  transport.start();
}

/**
 * Tears down playback. Not optional cleanup: without `cancel` / resetting
 * `position` / disposing the `Part`, the next Play resumes wherever the
 * transport stopped and layers a second copy of the score on top.
 */
export function stop(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;
  currentPart?.dispose();
  currentPart = null;
}

/**
 * The tick sounding right now, for the playhead. Converts *absolute*
 * elapsed seconds (`originSec + transport time`), not transport time alone
 * — a cursor placed after a tempo change would otherwise be timed against
 * the wrong tempo segment. Call from `requestAnimationFrame`, never from an
 * audio callback: those fire ahead of the audible time.
 */
export function playheadTick(score: Score): number {
  return secondsToTick(score, originSec + Tone.getTransport().seconds);
}
