import { describe, expect, it } from "vitest";
import { createDemoScore } from "../demo-score.ts";
import { GHOST_NOTE_RX, computeGhostPosition } from "./cursor.ts";
import { tickToX } from "./hit-test.ts";
import { computeClaimRegions } from "./layout-index.ts";
import type { LayoutIndex, StaveBox } from "./layout-index.ts";
import { drawMeasureColumn } from "./renderer.ts";
import {
  fakeRenderContext,
  installFakeTextMeasurementCanvas,
} from "./vexflow-mocks.ts";

function box(): StaveBox {
  return {
    systemIndex: 0,
    staveIndex: 0,
    clef: "treble",
    partIds: ["P"],
    x0: 0,
    x1: 200,
    y0: -Infinity,
    y1: Infinity,
    topLineY: 100,
    lineSpacing: 10,
    measures: [
      {
        index: 0,
        x0: 0,
        x1: 200,
        startTick: 0,
        endTick: 3840,
        noteAnchors: [],
      },
    ],
  };
}

describe("computeGhostPosition", () => {
  it("returns null where nothing claims the point", () => {
    const layoutIndex: LayoutIndex = { staves: [box()] };
    expect(computeGhostPosition(500, 500, layoutIndex, 960)).toBeNull();
  });

  it("snaps to the grid and lands on a stave line", () => {
    const b = box();
    const layoutIndex: LayoutIndex = { staves: [b] };
    const position = computeGhostPosition(50, 105, layoutIndex, 960);
    expect(position).not.toBeNull();
    expect(position!.cy).toBe(105); // topLineY + one half-step, exactly on a line
  });

  it("offsets cx right of the raw tick position by GHOST_NOTE_RX", () => {
    // Mirrors the real-notehead alignment fix: a real notehead glyph's x is
    // its LEFT edge (text-anchor: start), but an ellipse's cx is its center,
    // so the ghost must shift right by its own radius to line up with one.
    // x=50 snaps to tick 960 on this fixture (see hit-test.test.ts).
    const b = box();
    const layoutIndex: LayoutIndex = { staves: [b] };
    const position = computeGhostPosition(50, 105, layoutIndex, 960);
    expect(position!.cx).toBe(tickToX(960, b)! + GHOST_NOTE_RX);
  });

  it("hides (returns null) once the point falls outside the claimed x-range", () => {
    const b = box();
    const layoutIndex: LayoutIndex = { staves: [b] };
    expect(computeGhostPosition(b.x1 + 50, 105, layoutIndex, 960)).toBeNull();
  });
});

describe("computeGhostPosition against a real rendered stave", () => {
  installFakeTextMeasurementCanvas();

  it("hovering exactly on a real note offsets from its real anchor by GHOST_NOTE_RX", () => {
    const score = createDemoScore();
    const assignment = score.layout.staves[0]!;
    const [result] = drawMeasureColumn(
      fakeRenderContext(),
      score,
      [{ assignment, vexClef: assignment.clef, writtenShift: 0, y: 0 }],
      0,
    );
    const [claimRegion] = computeClaimRegions([result!.stave.getYForLine(0)]);
    const staveBox: StaveBox = {
      systemIndex: 0,
      staveIndex: 0,
      clef: assignment.clef,
      partIds: assignment.partIds,
      x0: result!.stave.getNoteStartX(),
      x1: result!.stave.getNoteEndX(),
      topLineY: result!.stave.getYForLine(0),
      lineSpacing: result!.stave.getSpacingBetweenLines(),
      measures: [
        {
          index: 0,
          x0: result!.stave.getNoteStartX(),
          x1: result!.stave.getNoteEndX(),
          startTick: score.measures[0]!.startTick,
          endTick: score.measures[0]!.startTick + 4 * score.divisions,
          noteAnchors: result!.noteAnchors,
        },
      ],
      ...claimRegion!,
    };
    const layoutIndex: LayoutIndex = { staves: [staveBox] };

    const anchor = staveBox.measures[0]!.noteAnchors[0]!;
    const position = computeGhostPosition(
      anchor.x,
      staveBox.topLineY,
      layoutIndex,
      score.divisions,
    );

    expect(position).not.toBeNull();
    expect(position!.cx).toBe(anchor.x + GHOST_NOTE_RX);
  });
});
