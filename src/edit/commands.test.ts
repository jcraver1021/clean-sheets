import { describe, expect, it } from "vitest";
import {
  deleteEventAt,
  insertNote,
  setAccidental,
  setDuration,
} from "./commands.ts";
import type { Score } from "../model/score.ts";

const QUARTER = 960;

function pitch(step: "C" | "D" | "E", octave = 4) {
  return { step, alter: 0 as const, octave };
}

function scoreWithOneNote(): Score {
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: QUARTER,
    parts: [
      {
        id: "P",
        name: "Part",
        events: [
          { id: "e0", tick: 0, durationTicks: QUARTER, pitches: [pitch("C")] },
        ],
      },
    ],
    measures: [
      {
        index: 0,
        startTick: 0,
        timeSig: { beats: 4, beatType: 4 },
        keyFifths: 0,
      },
    ],
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: { staves: [{ clef: "treble", partIds: ["P"] }] },
    lyricDisplay: { kind: "perPart" },
  };
}

describe("insertNote", () => {
  it("adds a new event when the tick range is empty", () => {
    const score = scoreWithOneNote();
    insertNote(score, "P", QUARTER, QUARTER, [pitch("D")]);
    const part = score.parts[0]!;
    expect(part.events).toHaveLength(2);
    expect(part.events.map((e) => e.tick)).toEqual([0, QUARTER]);
  });

  it("overwrites (removes) any event it fully or partially overlaps", () => {
    const score = scoreWithOneNote(); // one quarter note at tick 0
    insertNote(score, "P", 0, QUARTER * 2, [pitch("E")]); // a half note over the same start
    const part = score.parts[0]!;
    expect(part.events).toHaveLength(1);
    expect(part.events[0]!.pitches[0]!.step).toBe("E");
    expect(part.events[0]!.durationTicks).toBe(QUARTER * 2);
  });

  it("keeps events sorted by tick regardless of insertion order", () => {
    const score = scoreWithOneNote();
    insertNote(score, "P", QUARTER * 3, QUARTER, [pitch("D")]);
    insertNote(score, "P", QUARTER, QUARTER, [pitch("E")]);
    expect(score.parts[0]!.events.map((e) => e.tick)).toEqual([
      0,
      QUARTER,
      QUARTER * 3,
    ]);
  });

  it("throws for an unknown part", () => {
    const score = scoreWithOneNote();
    expect(() => insertNote(score, "NOPE", 0, QUARTER, [pitch("C")])).toThrow(
      /No part with id/,
    );
  });
});

describe("deleteEventAt", () => {
  it("removes the event covering the given tick", () => {
    const score = scoreWithOneNote();
    deleteEventAt(score, "P", 0);
    expect(score.parts[0]!.events).toHaveLength(0);
  });

  it("does nothing when no event covers that tick", () => {
    const score = scoreWithOneNote();
    deleteEventAt(score, "P", QUARTER * 5);
    expect(score.parts[0]!.events).toHaveLength(1);
  });
});

describe("setDuration", () => {
  it("extends a note's duration and clips any event it now overlaps", () => {
    const score = scoreWithOneNote();
    insertNote(score, "P", QUARTER, QUARTER, [pitch("D")]);
    setDuration(score, "P", "e0", QUARTER * 2); // now overlaps the D at tick QUARTER
    const part = score.parts[0]!;
    expect(part.events).toHaveLength(1);
    expect(part.events[0]!.durationTicks).toBe(QUARTER * 2);
  });

  it("throws for an unknown event id", () => {
    const score = scoreWithOneNote();
    expect(() => setDuration(score, "P", "nope", QUARTER)).toThrow(
      /No event with id/,
    );
  });
});

describe("setAccidental", () => {
  it("sets the alter on the event's pitch", () => {
    const score = scoreWithOneNote();
    setAccidental(score, "P", "e0", 1);
    expect(score.parts[0]!.events[0]!.pitches[0]!.alter).toBe(1);
  });

  it("throws when the pitch index doesn't exist (e.g. a rest)", () => {
    const score = scoreWithOneNote();
    score.parts[0]!.events[0]!.pitches = [];
    expect(() => setAccidental(score, "P", "e0", 1)).toThrow(
      /has no pitch at index/,
    );
  });
});
