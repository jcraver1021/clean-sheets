import type { LayoutPolicy, Part, Pitch, Score } from "./model/score.ts";

const QUARTER = 960;

function part(id: string, name: string, sounding: Pitch[]): Part {
  const measureTicks = [0, 4 * QUARTER];
  return {
    id,
    name,
    events: measureTicks.flatMap((measureStart) =>
      sounding.map((pitch, beat) => ({
        id: `${id}-${measureStart}-${beat}`,
        tick: measureStart + beat * QUARTER,
        durationTicks: QUARTER,
        pitches: [pitch],
      })),
    ),
  };
}

const GRAND_STAFF_LAYOUT: LayoutPolicy = {
  kind: "grandStaff",
  staves: [
    { clef: "treble", partIds: ["S", "A"] },
    { clef: "bass", partIds: ["T", "B"] },
  ],
};

const OPEN_SCORE_LAYOUT: LayoutPolicy = {
  kind: "openScore",
  staves: [
    { clef: "treble", partIds: ["S"] },
    { clef: "treble", partIds: ["A"] },
    { clef: "treble8vb", partIds: ["T"] },
    { clef: "bass", partIds: ["B"] },
  ],
};

export const LAYOUTS_BY_KIND: Record<LayoutPolicy["kind"], LayoutPolicy> = {
  grandStaff: GRAND_STAFF_LAYOUT,
  openScore: OPEN_SCORE_LAYOUT,
};

/**
 * A 2-measure SATB fixture — the Stage 0 sketch's music, now driven by the
 * model.
 */
export function createDemoScore(): Score {
  return {
    schemaVersion: 1,
    title: "Stage 1 demo",
    divisions: QUARTER,
    parts: [
      part("S", "Soprano", [
        { step: "C", alter: 0, octave: 5 },
        { step: "D", alter: 0, octave: 5 },
        { step: "E", alter: 0, octave: 5 },
        { step: "C", alter: 0, octave: 5 },
      ]),
      part("A", "Alto", [
        { step: "G", alter: 0, octave: 4 },
        { step: "F", alter: 0, octave: 4 },
        { step: "E", alter: 0, octave: 4 },
        { step: "G", alter: 0, octave: 4 },
      ]),
      part("T", "Tenor", [
        { step: "C", alter: 0, octave: 4 },
        { step: "B", alter: 0, octave: 3 },
        { step: "C", alter: 0, octave: 4 },
        { step: "C", alter: 0, octave: 4 },
      ]),
      part("B", "Bass", [
        { step: "E", alter: 0, octave: 3 },
        { step: "D", alter: 0, octave: 3 },
        { step: "C", alter: 0, octave: 3 },
        { step: "C", alter: 0, octave: 3 },
      ]),
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
        startTick: 4 * QUARTER,
        timeSig: { beats: 4, beatType: 4 },
        keyFifths: 0,
      },
    ],
    tempoMap: [{ tick: 0, bpm: 96 }],
    layout: GRAND_STAFF_LAYOUT,
    lyricDisplay: { kind: "shared", sourcePartId: "S" },
  };
}
