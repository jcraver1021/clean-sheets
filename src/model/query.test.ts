import { describe, expect, it } from "vitest";
import {
  eventsForMeasure,
  keyAt,
  measureAt,
  measureEndTick,
  timeAt,
} from "./query.ts";
import type { NoteEvent, Score } from "./score.ts";

const DIVISIONS = 960;

function note(tick: number): NoteEvent {
  return {
    id: `n${tick}`,
    tick,
    durationTicks: 1,
    pitches: [{ step: "C", alter: 0, octave: 4 }],
  };
}

// 4/4, then 3/4, then 6/8 (last, so its end tick is computed rather than
// read off the next measure) — exercises measureEndTick's fallback formula
// across two different beatTypes.
const score: Score = {
  schemaVersion: 1,
  title: "query fixture",
  divisions: DIVISIONS,
  parts: [
    {
      id: "P",
      name: "Part",
      events: [0, 3839, 3840, 6719, 6720, 9599].map(note),
    },
  ],
  measures: [
    {
      index: 0,
      startTick: 0,
      timeSig: { beats: 4, beatType: 4 },
      keyFifths: 0,
    },
    {
      index: 1,
      startTick: 3840,
      timeSig: { beats: 3, beatType: 4 },
      keyFifths: 2,
    },
    {
      index: 2,
      startTick: 6720,
      timeSig: { beats: 6, beatType: 8 },
      keyFifths: -3,
    },
  ],
  tempoMap: [{ tick: 0, bpm: 96 }],
  layout: { staves: [{ clef: "treble", partIds: ["P"] }] },
  lyricDisplay: { kind: "perPart" },
};

describe("measureAt", () => {
  it("finds the measure containing a tick, including right at its start", () => {
    expect(measureAt(score, 0).index).toBe(0);
    expect(measureAt(score, 3840).index).toBe(1);
  });

  it("stays in the previous measure right up to the next one's start", () => {
    expect(measureAt(score, 3839).index).toBe(0);
  });

  it("throws for a tick before the first measure", () => {
    expect(() => measureAt(score, -1)).toThrow(/No measure covers tick/);
  });
});

describe("measureEndTick", () => {
  it("uses the next measure's start when there is one", () => {
    expect(measureEndTick(score, score.measures[0]!)).toBe(3840);
  });

  it("computes from beats/beatType for the last measure, across beatTypes", () => {
    // measure 1: 3/4 -> 3 * 960 = 2880 ticks past its start.
    expect(measureEndTick(score, score.measures[1]!)).toBe(6720);
    // measure 2 (last): 6/8 -> 6 * 960 * 4/8 = 2880 ticks past its start,
    // the same length as measure 1's 3/4 despite the different beatType.
    expect(measureEndTick(score, score.measures[2]!)).toBe(9600);
  });
});

describe("keyAt / timeAt", () => {
  it("read the key and time signature of the measure at a tick", () => {
    expect(keyAt(score, 3840)).toBe(2);
    expect(timeAt(score, 6720)).toEqual({ beats: 6, beatType: 8 });
  });
});

describe("eventsForMeasure", () => {
  it("includes events from the measure's start up to but not including its end", () => {
    expect(eventsForMeasure(score, "P", 0).map((e) => e.tick)).toEqual([
      0, 3839,
    ]);
    expect(eventsForMeasure(score, "P", 1).map((e) => e.tick)).toEqual([
      3840, 6719,
    ]);
    expect(eventsForMeasure(score, "P", 2).map((e) => e.tick)).toEqual([
      6720, 9599,
    ]);
  });

  it("throws for an unknown measure index or part id", () => {
    expect(() => eventsForMeasure(score, "P", 99)).toThrow(
      /No measure at index/,
    );
    expect(() => eventsForMeasure(score, "NOPE", 0)).toThrow(/No part with id/);
  });
});
