import {
  Accidental,
  Beam,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from "vexflow";
import type { RenderContext } from "vexflow";
import { toDiatonic } from "../model/pitch.ts";
import { eventsForMeasure, keyAt, measureEndTick } from "../model/query.ts";
import type {
  Clef,
  NoteEvent,
  Score,
  StaveAssignment,
} from "../model/score.ts";
import { computeClaimRegions } from "./layout-index.ts";
import type {
  LayoutIndex,
  MeasureBox,
  NoteAnchor,
  StaveBox,
} from "./layout-index.ts";
import {
  decomposeDurationTicks,
  stemFor,
  toVexDuration,
  toVexKey,
  toVexKeySignature,
} from "./vex-adapt.ts";

// Model stores sounding pitch; treble8vb is written a diatonic 7th above
// sounding. hit-test.ts applies the shift in reverse.
const TREBLE_8VB_WRITTEN_SHIFT = 7;

// Wide enough that a sixteenth-note slot stays clickable after formatToStave
// redistributes space — a fixed 220px left slots as narrow as ~9px.
const MEASURE_WIDTH = 500;
const STAVE_ROW_HEIGHT = 110;
const SYSTEM_LEFT_MARGIN = 10;
const SYSTEM_TOP_MARGIN = 20;

/**
 * VexFlow has no `treble8vb` — it's `treble` with a cosmetic `8vb` annotation
 * (see `Clef`).
 */
function toVexClefName(clef: Clef): string {
  return clef === "treble8vb" ? "treble" : clef;
}

function buildStaveNote(
  event: NoteEvent,
  score: Score,
  vexClef: string,
  writtenShift: number,
  stemDirection: number | undefined,
): StaveNote {
  const { duration, dots } = toVexDuration(
    event.durationTicks,
    score.divisions,
  );
  if (event.pitches.length === 0) {
    return new StaveNote({
      keys: ["b/4"],
      duration,
      dots,
      type: "r",
      clef: vexClef,
    });
  }
  const keys = event.pitches.map((pitch) =>
    toVexKey(toDiatonic(pitch) + writtenShift, pitch.alter),
  );
  return new StaveNote({ keys, duration, dots, clef: vexClef, stemDirection });
}

// Carries events alongside their notes so the caller can pair each note's
// real formatted position (only known after voice.draw()) back to its tick.
type PartVoice = { voice: Voice; events: NoteEvent[]; notes: StaveNote[] };

/**
 * Fills every silent stretch between `startTick` and `endTick` that
 * `events` doesn't cover with explicit rests. VexFlow's per-voice tick
 * accounting only knows the tickables it's handed — a silent gap must
 * become rests, or later notes in that voice drift out of alignment.
 */
function fillGapsWithRests(
  events: NoteEvent[],
  startTick: number,
  endTick: number,
  divisions: number,
): NoteEvent[] {
  const filled: NoteEvent[] = [];
  let cursor = startTick;
  const restAt = (tick: number, durationTicks: number): NoteEvent => ({
    id: `rest-${tick}`,
    tick,
    durationTicks,
    pitches: [],
  });

  for (const event of events) {
    for (const gap of decomposeDurationTicks(event.tick - cursor, divisions)) {
      filled.push(restAt(cursor, gap));
      cursor += gap;
    }
    filled.push(event);
    cursor = event.tick + event.durationTicks;
  }
  for (const gap of decomposeDurationTicks(endTick - cursor, divisions)) {
    filled.push(restAt(cursor, gap));
    cursor += gap;
  }
  return filled;
}

function buildVoiceForPart(
  score: Score,
  partId: string,
  measureIndex: number,
  vexClef: string,
  writtenShift: number,
  stemDirection: number | undefined,
): PartVoice {
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`No measure at index ${measureIndex}`);
  const events = fillGapsWithRests(
    eventsForMeasure(score, partId, measureIndex),
    measure.startTick,
    measureEndTick(score, measure),
    score.divisions,
  );
  const notes = events.map((event) =>
    buildStaveNote(event, score, vexClef, writtenShift, stemDirection),
  );
  const voice = new Voice({
    numBeats: measure.timeSig.beats,
    beatValue: measure.timeSig.beatType,
  }).setStrict(false);
  voice.addTickables(notes);
  return { voice, events, notes };
}

/**
 * One row's fixed setup — everything `drawMeasureColumn` needs about a
 * row besides which measure it's drawing.
 */
export type RowSetup = {
  assignment: StaveAssignment;
  vexClef: string;
  writtenShift: number;
  y: number;
};

// One row's contribution to a single measure column.
type RowMeasureResult = { stave: Stave; noteAnchors: NoteAnchor[] };

/**
 * Draws one measure column across every row and returns each row's stave
 * and note positions. All rows' voices are joined into a single
 * `Formatter` pass — not formatted per row — so a note at a given tick
 * lands at the same x on every row, regardless of that row's own rhythm.
 * `formatBegModifiers` does the same for clef/time-signature widths, which
 * otherwise differ slightly by clef.
 *
 * Exported for testability (see renderer.test.ts): runs against a fake
 * RenderContext, no browser or jsdom needed.
 */
export function drawMeasureColumn(
  ctx: RenderContext,
  score: Score,
  rows: RowSetup[],
  measureIndex: number,
): RowMeasureResult[] {
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`No measure at index ${measureIndex}`);
  const x = SYSTEM_LEFT_MARGIN + measureIndex * MEASURE_WIDTH;

  const staves = rows.map((row) => {
    const stave = new Stave(x, row.y, MEASURE_WIDTH);
    if (measureIndex === 0) {
      stave.addClef(
        row.vexClef,
        "default",
        row.assignment.clef === "treble8vb" ? "8vb" : undefined,
      );
      stave.addTimeSignature(
        `${measure.timeSig.beats}/${measure.timeSig.beatType}`,
      );
    }
    return stave;
  });
  Stave.formatBegModifiers(staves);
  staves.forEach((stave) => stave.setContext(ctx).draw());

  const rowVoices = rows.map((row) =>
    row.assignment.partIds.map((partId, indexInStave) =>
      buildVoiceForPart(
        score,
        partId,
        measureIndex,
        row.vexClef,
        row.writtenShift,
        stemFor(row.assignment.partIds.length, indexInStave),
      ),
    ),
  );
  rowVoices.forEach((partVoices) =>
    Accidental.applyAccidentals(
      partVoices.map((partVoice) => partVoice.voice),
      toVexKeySignature(keyAt(score, measure.startTick)),
    ),
  );

  // formatToStave (not a fixed width) accounts for the clef/time signature
  // eating into measure 0's stave. Which row's stave is passed no longer
  // matters — formatBegModifiers already equalized every row's noteStartX.
  const allVoices = rowVoices.flat().map((partVoice) => partVoice.voice);
  new Formatter().joinVoices(allVoices).formatToStave(allVoices, staves[0]!);

  const beamGroups = Beam.getDefaultBeamGroups(
    `${measure.timeSig.beats}/${measure.timeSig.beatType}`,
  );

  return staves.map((stave, rowIndex) => {
    const partVoices = rowVoices[rowIndex]!;

    // Beams must exist before draw(): StaveNote.hasFlag() only suppresses
    // the flag glyph if the beam is attached before drawing, not after.
    // maintainStemDirections keeps our stemFor convention instead of
    // letting generateBeams reassign stems by pitch.
    const beams = partVoices.flatMap((partVoice) =>
      Beam.generateBeams(partVoice.notes, {
        maintainStemDirections: true,
        groups: beamGroups,
      }),
    );
    partVoices.forEach((partVoice) => partVoice.voice.draw(ctx, stave));
    beams.forEach((beam) => beam.setContext(ctx).draw());

    // Real positions, not an equal split of MEASURE_WIDTH — hit-test.ts
    // interpolates between these. Simultaneous notes across voices share a
    // tick, so later voices simply overwrite earlier ones here.
    const anchorsByTick = new Map<number, number>();
    for (const partVoice of partVoices) {
      partVoice.events.forEach((event, i) =>
        anchorsByTick.set(event.tick, partVoice.notes[i]!.getAbsoluteX()),
      );
    }
    const noteAnchors: NoteAnchor[] = [...anchorsByTick.entries()]
      .map(([tick, x]) => ({ tick, x }))
      .sort((a, b) => a.tick - b.tick);

    return { stave, noteAnchors };
  });
}

// Everything a stave row contributes to the layout index except y0/y1: those
// need every row's topLineY first, so renderScore fills them in afterward.
type PartialStaveBox = Omit<StaveBox, "y0" | "y1">;

/**
 * Draws `score` into `container` as SVG, one row per stave in the layout,
 * and returns the layout index that hit-testing (Stage 2) reads from.
 */
export function renderScore(
  container: HTMLDivElement,
  score: Score,
): LayoutIndex {
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(
    SYSTEM_LEFT_MARGIN * 2 + score.measures.length * MEASURE_WIDTH,
    SYSTEM_TOP_MARGIN + score.layout.staves.length * STAVE_ROW_HEIGHT,
  );
  const ctx = renderer.getContext();

  const rows: RowSetup[] = score.layout.staves.map((assignment, rowIndex) => ({
    assignment,
    vexClef: toVexClefName(assignment.clef),
    writtenShift:
      assignment.clef === "treble8vb" ? TREBLE_8VB_WRITTEN_SHIFT : 0,
    y: SYSTEM_TOP_MARGIN + rowIndex * STAVE_ROW_HEIGHT,
  }));

  const measuresByRow: MeasureBox[][] = rows.map(() => []);
  const topLineYByRow: number[] = [];
  const lineSpacingByRow: number[] = [];

  for (
    let measureIndex = 0;
    measureIndex < score.measures.length;
    measureIndex++
  ) {
    const measure = score.measures[measureIndex];
    if (!measure) throw new Error(`No measure at index ${measureIndex}`);
    const results = drawMeasureColumn(ctx, score, rows, measureIndex);
    results.forEach(({ stave, noteAnchors }, rowIndex) => {
      topLineYByRow[rowIndex] = stave.getYForLine(0);
      lineSpacingByRow[rowIndex] = stave.getSpacingBetweenLines();
      measuresByRow[rowIndex]!.push({
        index: measureIndex,
        x0: stave.getNoteStartX(),
        x1: stave.getNoteEndX(),
        startTick: measure.startTick,
        endTick: measureEndTick(score, measure),
        noteAnchors,
      });
    });
  }

  const partialBoxes: PartialStaveBox[] = rows.map((row, rowIndex) => ({
    systemIndex: 0,
    staveIndex: rowIndex,
    clef: row.assignment.clef,
    partIds: row.assignment.partIds,
    x0: SYSTEM_LEFT_MARGIN,
    x1: SYSTEM_LEFT_MARGIN + score.measures.length * MEASURE_WIDTH,
    topLineY: topLineYByRow[rowIndex]!,
    lineSpacing: lineSpacingByRow[rowIndex]!,
    measures: measuresByRow[rowIndex]!,
  }));
  const claimRegions = computeClaimRegions(
    partialBoxes.map((box) => box.topLineY),
  );
  const staves: StaveBox[] = partialBoxes.map((box, i) => ({
    ...box,
    ...claimRegions[i]!,
  }));

  return { staves };
}
