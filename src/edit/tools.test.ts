import { beforeEach, describe, expect, it } from "vitest";
import { resolveAlter, setAccidentalOverride } from "./tools.ts";
import type { Score } from "../model/score.ts";

function fixtureScore(keyFifths: number): Score {
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: 960,
    parts: [],
    measures: [
      { index: 0, startTick: 0, timeSig: { beats: 4, beatType: 4 }, keyFifths },
    ],
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: { staves: [] },
    lyricDisplay: { kind: "perPart" },
  };
}

describe("resolveAlter", () => {
  beforeEach(() => {
    setAccidentalOverride(null);
  });

  it("derives from the key signature when there's no override", () => {
    const score = fixtureScore(2); // D major: F#, C#
    expect(resolveAlter(score, 0, "F")).toBe(1);
    expect(resolveAlter(score, 0, "G")).toBe(0);
  });

  it("prefers the override over the key signature", () => {
    setAccidentalOverride(-1);
    const score = fixtureScore(2); // F would normally be sharp
    expect(resolveAlter(score, 0, "F")).toBe(-1);
  });
});
