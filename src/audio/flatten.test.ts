import { describe, expect, it } from "vitest";
import type { NoteEvent, Part, Score } from "../model/score.ts";
import { computeFlatten, flatten } from "./flatten.ts";

function scoreWithEvents(...parts: Array<Pick<Part, "id" | "events">>): Score {
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: 960,
    parts: parts.map((part) => ({ ...part, name: part.id })),
    measures: [
      {
        index: 0,
        startTick: 0,
        timeSig: { beats: 4, beatType: 4 },
        keyFifths: 0,
      },
    ],
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: { staves: [] },
    lyricDisplay: { kind: "perPart" },
  };
}

const C5 = { step: "C" as const, alter: 0 as const, octave: 5 };
const E5 = { step: "E" as const, alter: 0 as const, octave: 5 };

describe("computeFlatten", () => {
  it("drops rests", () => {
    const events = computeFlatten(
      scoreWithEvents({
        id: "P",
        events: [{ id: "r", tick: 0, durationTicks: 960, pitches: [] }],
      }),
    );
    expect(events).toEqual([]);
  });

  it("expands a chord into one SoundEvent per pitch", () => {
    const events = computeFlatten(
      scoreWithEvents({
        id: "P",
        events: [{ id: "c", tick: 0, durationTicks: 960, pitches: [C5, E5] }],
      }),
    );
    expect(events).toEqual([
      { partId: "P", tick: 0, durationTicks: 960, midi: 72 },
      { partId: "P", tick: 0, durationTicks: 960, midi: 76 },
    ]);
  });

  it("resolves a start/stop tie chain into one longer event", () => {
    const chain: NoteEvent[] = [
      { id: "a", tick: 0, durationTicks: 960, pitches: [C5], tie: "start" },
      { id: "b", tick: 960, durationTicks: 960, pitches: [C5], tie: "stop" },
    ];
    const events = computeFlatten(scoreWithEvents({ id: "P", events: chain }));
    expect(events).toEqual([
      { partId: "P", tick: 0, durationTicks: 1920, midi: 72 },
    ]);
  });

  it("resolves a three-note chain through a 'both' link", () => {
    const chain: NoteEvent[] = [
      { id: "a", tick: 0, durationTicks: 960, pitches: [C5], tie: "start" },
      { id: "b", tick: 960, durationTicks: 960, pitches: [C5], tie: "both" },
      { id: "c", tick: 1920, durationTicks: 960, pitches: [C5], tie: "stop" },
    ];
    const events = computeFlatten(scoreWithEvents({ id: "P", events: chain }));
    expect(events).toEqual([
      { partId: "P", tick: 0, durationTicks: 2880, midi: 72 },
    ]);
  });

  it("doesn't merge across a pitch change even if marked tied", () => {
    const events: NoteEvent[] = [
      { id: "a", tick: 0, durationTicks: 960, pitches: [C5], tie: "start" },
      { id: "b", tick: 960, durationTicks: 960, pitches: [E5], tie: "stop" },
    ];
    const flattened = computeFlatten(scoreWithEvents({ id: "P", events }));
    expect(flattened).toEqual([
      { partId: "P", tick: 0, durationTicks: 960, midi: 72 },
      { partId: "P", tick: 960, durationTicks: 960, midi: 76 },
    ]);
  });

  it("sorts by tick across parts", () => {
    const events = computeFlatten(
      scoreWithEvents(
        {
          id: "A",
          events: [{ id: "a", tick: 960, durationTicks: 960, pitches: [C5] }],
        },
        {
          id: "B",
          events: [{ id: "b", tick: 0, durationTicks: 960, pitches: [E5] }],
        },
      ),
    );
    expect(events.map((e) => e.partId)).toEqual(["B", "A"]);
  });
});

describe("flatten", () => {
  it("caches by revision and recomputes when it changes", () => {
    const score = scoreWithEvents({
      id: "P",
      events: [{ id: "a", tick: 0, durationTicks: 960, pitches: [C5] }],
    });
    const first = flatten(score, 1);
    expect(flatten(score, 1)).toBe(first); // same revision: cache hit
    const second = flatten(score, 2);
    expect(second).not.toBe(first); // new revision: recomputed
    expect(second).toEqual(first); // same underlying data either way
  });
});
