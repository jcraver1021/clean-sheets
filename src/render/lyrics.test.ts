import { describe, expect, it } from "vitest";
import type { NoteEvent, Part, Score } from "../model/score.ts";
import { lyricLinesForRow, sharedLyricLineCount } from "./lyrics.ts";

function part(id: string, ...verses: number[]): Part {
  const events: NoteEvent[] = [
    {
      id: `${id}-0`,
      tick: 0,
      durationTicks: 960,
      pitches: [{ step: "C", alter: 0, octave: 4 }],
      lyrics: verses.map((verse) => ({
        verse,
        syllable: "single" as const,
        text: "la",
      })),
    },
  ];
  return { id, name: id, events };
}

function scoreWithParts(
  parts: Part[],
  lyricDisplay: Score["lyricDisplay"],
): Score {
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: 960,
    parts,
    measures: [
      {
        index: 0,
        startTick: 0,
        timeSig: { beats: 4, beatType: 4 },
        keyFifths: 0,
      },
    ],
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: { staves: parts.map((p) => ({ clef: "treble", partIds: [p.id] })) },
    lyricDisplay,
  };
}

describe("lyricLinesForRow", () => {
  it("is 0 for shared display, regardless of the part's own verses", () => {
    const score = scoreWithParts([part("S", 1, 2)], {
      kind: "shared",
      sourcePartId: "S",
    });
    expect(lyricLinesForRow(score, "S")).toBe(0);
  });

  it("counts the part's own verses for perPart display", () => {
    const score = scoreWithParts([part("S", 1, 2)], { kind: "perPart" });
    expect(lyricLinesForRow(score, "S")).toBe(2);
  });

  it("is 0 for a part with no lyrics, or an undefined partId", () => {
    const score = scoreWithParts([part("S")], { kind: "perPart" });
    expect(lyricLinesForRow(score, "S")).toBe(0);
    expect(lyricLinesForRow(score, undefined)).toBe(0);
  });
});

describe("sharedLyricLineCount", () => {
  it("counts the source part's verses for shared display", () => {
    const score = scoreWithParts([part("S", 1, 2, 3), part("A")], {
      kind: "shared",
      sourcePartId: "S",
    });
    expect(sharedLyricLineCount(score)).toBe(3);
  });

  it("is 0 for perPart display", () => {
    const score = scoreWithParts([part("S", 1)], { kind: "perPart" });
    expect(sharedLyricLineCount(score)).toBe(0);
  });
});
