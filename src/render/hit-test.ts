import type { Clef } from "../model/score.ts";
import type { LayoutIndex, StaveBox } from "./layout-index.ts";

export type Hit = { box: StaveBox; tick: number; diatonic: number };

export function hitTest(
  x: number,
  y: number,
  idx: LayoutIndex,
  gridTicks: number,
): Hit | null {
  const box = idx.staves.find(
    (b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1,
  );
  if (!box) return null;
  const tick = xToTick(x, box, gridTicks);
  if (tick === null) return null;
  return { box, tick, diatonic: yToDiatonic(y, box) };
}

// Diatonic index of the SOUNDING pitch on each clef's top line.
//   treble    top line = F5                 -> 5*7 + 3 = 38
//   bass      top line = A3                 -> 3*7 + 5 = 26
//   treble8vb top line reads F5, sounds F4  -> 38 - 7  = 31
const TOP_LINE_DIATONIC: Record<Clef, number> = {
  treble: 38,
  bass: 26,
  treble8vb: 31,
};

/** Screen -> model: one half line-space is one diatonic step. Returns sounding pitch for every clef. */
export function yToDiatonic(y: number, box: StaveBox): number {
  const halfSteps = Math.round((y - box.topLineY) / (box.lineSpacing / 2));
  return TOP_LINE_DIATONIC[box.clef] - halfSteps;
}

/** Model -> screen inverse of `yToDiatonic`, for positioning the ghost note/cursor. */
export function diatonicToY(diatonic: number, box: StaveBox): number {
  const halfSteps = TOP_LINE_DIATONIC[box.clef] - diatonic;
  return box.topLineY + halfSteps * (box.lineSpacing / 2);
}

export function xToTick(
  x: number,
  box: StaveBox,
  gridTicks: number,
): number | null {
  const bar = box.measures.find((b) => x >= b.x0 && x <= b.x1);
  if (!bar) return null;
  const frac = (x - bar.x0) / (bar.x1 - bar.x0);
  const raw = bar.startTick + frac * (bar.endTick - bar.startTick);
  const snapped =
    bar.startTick + Math.round((raw - bar.startTick) / gridTicks) * gridTicks;
  // Clamp: rounding near the barline, or a grid coarser than the bar
  // (half-note grid in 3/4, or a pickup measure), can overshoot into the next bar.
  return Math.min(snapped, Math.max(bar.startTick, bar.endTick - gridTicks));
}

/** Model -> screen inverse of `xToTick`, for positioning the ghost note/cursor. */
export function tickToX(tick: number, box: StaveBox): number | null {
  const bar = box.measures.find((b) => tick >= b.startTick && tick < b.endTick);
  if (!bar) return null;
  const frac = (tick - bar.startTick) / (bar.endTick - bar.startTick);
  return bar.x0 + frac * (bar.x1 - bar.x0);
}
