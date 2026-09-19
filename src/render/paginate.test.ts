import { describe, expect, it } from "vitest";
import type { MeasureSpec, Score } from "../model/score.ts";
import { paginate } from "./paginate.ts";

function scoreWithMeasures(count: number): Score {
  const measures: MeasureSpec[] = Array.from({ length: count }, (_, index) => ({
    index,
    startTick: index * 3840,
    timeSig: { beats: 4, beatType: 4 },
    keyFifths: 0,
  }));
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: 960,
    parts: [],
    measures,
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: { staves: [] },
    lyricDisplay: { kind: "perPart" },
  };
}

describe("paginate", () => {
  it("groups measures into systems, then systems into pages", () => {
    const score = scoreWithMeasures(10);
    const pages = paginate(score, {
      measureWidth: 100,
      systemWidth: 350, // 3 measures/system
      systemHeight: 50,
      pageHeight: 110, // 2 systems/page
    });
    expect(pages).toEqual([
      {
        systems: [
          [0, 1, 2],
          [3, 4, 5],
        ],
      },
      { systems: [[6, 7, 8], [9]] },
    ]);
  });

  it("gives an empty score one empty page rather than zero pages", () => {
    const score = scoreWithMeasures(0);
    const pages = paginate(score, {
      measureWidth: 100,
      systemWidth: 350,
      systemHeight: 50,
      pageHeight: 110,
    });
    expect(pages).toEqual([{ systems: [] }]);
  });

  it("floors to at least one measure per system even if it doesn't fit", () => {
    const score = scoreWithMeasures(2);
    const pages = paginate(score, {
      measureWidth: 1000,
      systemWidth: 350,
      systemHeight: 50,
      pageHeight: 110,
    });
    expect(pages).toEqual([{ systems: [[0], [1]] }]);
  });

  it("floors to at least one system per page even if it doesn't fit", () => {
    const score = scoreWithMeasures(2);
    const pages = paginate(score, {
      measureWidth: 100,
      systemWidth: 350,
      systemHeight: 1000,
      pageHeight: 110,
    });
    expect(pages).toEqual([{ systems: [[0, 1]] }]);
  });
});
