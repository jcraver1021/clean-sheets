import { describe, expect, it } from "vitest";
import { createDemoScore } from "../demo-score.ts";
import type { Score } from "../model/score.ts";
import { drawMeasureColumn } from "./renderer.ts";
import type { RowSetup } from "./renderer.ts";
import {
  fakeRenderContext,
  installFakeTextMeasurementCanvas,
} from "./vexflow-mocks.ts";

function rowsFor(score: Score): RowSetup[] {
  return score.layout.staves.map((assignment, rowIndex) => ({
    assignment,
    vexClef: assignment.clef === "treble8vb" ? "treble" : assignment.clef,
    writtenShift: assignment.clef === "treble8vb" ? 7 : 0,
    y: rowIndex * 110,
  }));
}

// A fixture with two parts on different rhythms in the same measure — the
// scenario that used to drift apart when each row was formatted on its own.
function differingRhythmScore(): Score {
  return {
    schemaVersion: 1,
    title: "fixture",
    divisions: 960,
    parts: [
      {
        id: "quarters",
        name: "Quarters",
        events: [0, 960, 1920, 2880].map((tick) => ({
          id: `q-${tick}`,
          tick,
          durationTicks: 960,
          pitches: [{ step: "C" as const, alter: 0 as const, octave: 5 }],
        })),
      },
      {
        id: "eighths",
        name: "Eighths",
        events: [0, 480, 960, 1440, 1920, 2400, 2880, 3360].map((tick) => ({
          id: `e-${tick}`,
          tick,
          durationTicks: 480,
          pitches: [{ step: "E" as const, alter: 0 as const, octave: 5 }],
        })),
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
    layout: {
      staves: [
        { clef: "treble", partIds: ["quarters"] },
        { clef: "treble", partIds: ["eighths"] },
      ],
    },
    lyricDisplay: { kind: "perPart" },
  };
}

describe("drawMeasureColumn", () => {
  installFakeTextMeasurementCanvas();

  it("keeps every note's real position within its own measure's bounds", () => {
    const score = createDemoScore();
    const [result] = drawMeasureColumn(
      fakeRenderContext(),
      score,
      rowsFor(score),
      0,
    );

    for (const anchor of result!.noteAnchors) {
      expect(anchor.x).toBeGreaterThanOrEqual(result!.stave.getNoteStartX());
      expect(anchor.x).toBeLessThanOrEqual(result!.stave.getNoteEndX());
    }
  });

  it("aligns shared ticks across rows even when their rhythms differ", () => {
    const score = differingRhythmScore();
    const [quarters, eighths] = drawMeasureColumn(
      fakeRenderContext(),
      score,
      rowsFor(score),
      0,
    );

    const eighthsByTick = new Map(
      eighths!.noteAnchors.map((anchor) => [anchor.tick, anchor.x]),
    );
    for (const anchor of quarters!.noteAnchors) {
      expect(eighthsByTick.get(anchor.tick)).toBe(anchor.x);
    }
  });
});
