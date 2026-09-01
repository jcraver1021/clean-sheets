import type { Clef } from "../model/score.ts";

/**
 * A real note's onset tick and its formatted x, captured after drawing.
 */
export type NoteAnchor = { tick: number; x: number };

/**
 * One measure's geometry within a stave: its x-range, tick-range, and the
 * real note positions (`noteAnchors`) hit-test.ts interpolates between.
 */
export type MeasureBox = {
  index: number;
  x0: number;
  x1: number;
  startTick: number;
  endTick: number;
  noteAnchors: NoteAnchor[]; // Sorted by tick; hit-test.ts interpolates between these, not an even split across x0..x1.
};

/**
 * One stave's geometry, captured during the draw pass. `y0`/`y1` are a claim
 * region, not the stave's ink — see `computeClaimRegions`. `x0`/`x1` span the
 * whole row; `measures[].x0`/`x1` are each measure's actual note-bearing
 * span (after its clef/time signature, if any), not an equal split.
 */
export type StaveBox = {
  systemIndex: number;
  staveIndex: number;
  clef: Clef;
  partIds: string[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  topLineY: number;
  lineSpacing: number;
  pageIndex?: number; // Stage 7.
  measures: MeasureBox[];
};

/**
 * The full layout hit-testing reads from: every stave's box, captured during
 * the draw pass.
 */
export type LayoutIndex = {
  pageCount?: number; // Stage 7.
  staves: StaveBox[];
};

/**
 * Splits the vertical space between stacked staves into non-overlapping claim
 * regions, halfway between each stave's anchor and its neighbors'. The
 * outermost staves extend to +/-Infinity — nothing bounds them yet without
 * pagination. A ledger-line note far outside a stave's ink still belongs to
 * that stave, so these regions must tile the system with no gaps rather than
 * track where the lines are actually drawn.
 */
export function computeClaimRegions(
  anchorYs: number[],
): Array<{ y0: number; y1: number }> {
  return anchorYs.map((anchorY, i) => {
    const previous = anchorYs[i - 1];
    const next = anchorYs[i + 1];
    return {
      y0: previous === undefined ? -Infinity : (previous + anchorY) / 2,
      y1: next === undefined ? Infinity : (anchorY + next) / 2,
    };
  });
}
