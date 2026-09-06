import { describe, expect, it } from "vitest";
import type { Score, TempoPoint } from "./score.ts";
import { secondsToTick, tickToSeconds } from "./tempo.ts";

function scoreWithTempo(tempoMap: TempoPoint[]): Score {
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: 960,
    parts: [],
    measures: [
      {
        index: 0,
        startTick: 0,
        timeSig: { beats: 4, beatType: 4 },
        keyFifths: 0,
      },
    ],
    tempoMap,
    layout: { staves: [] },
    lyricDisplay: { kind: "perPart" },
  };
}

describe("tickToSeconds / secondsToTick", () => {
  it("round-trips across a tempo change", () => {
    const score = scoreWithTempo([
      { tick: 0, bpm: 60 },
      { tick: 960, bpm: 120 },
    ]);
    for (const tick of [0, 480, 960, 1440, 1920]) {
      const seconds = tickToSeconds(score, tick);
      expect(secondsToTick(score, seconds)).toBeCloseTo(tick, 6);
    }
  });

  it("round-trips across a duplicate-tick (instantaneous) map", () => {
    const score = scoreWithTempo([
      { tick: 0, bpm: 60 },
      { tick: 960, bpm: 60 },
      { tick: 960, bpm: 120 },
    ]);
    for (const tick of [0, 480, 960, 1440]) {
      const seconds = tickToSeconds(score, tick);
      expect(secondsToTick(score, seconds)).toBeCloseTo(tick, 6);
    }
  });

  it("matches the spec's worked example: a cursor after a tempo change must convert absolute elapsed time, not time relative to the cursor", () => {
    // 60bpm for the first quarter note, then 120bpm — tick 1920 sits 1.5s in.
    const score = scoreWithTempo([
      { tick: 0, bpm: 60 },
      { tick: 960, bpm: 120 },
    ]);
    const originSec = tickToSeconds(score, 1920);
    expect(originSec).toBeCloseTo(1.5, 6);

    // Half a second later, absolute time is what must be converted.
    expect(secondsToTick(score, originSec + 0.5)).toBeCloseTo(2880, 6);
    // The wrong (relative) version would answer 2400 instead.
    expect(secondsToTick(score, originSec + 0.5)).not.toBeCloseTo(2400, 6);
  });
});
