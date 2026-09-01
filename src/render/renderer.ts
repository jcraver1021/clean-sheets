import {
  Accidental,
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
  stemFor,
  toVexDuration,
  toVexKey,
  toVexKeySignature,
} from "./vex-adapt.ts";

// Model stores sounding pitch (score.ts). treble8vb is written a diatonic 7th
// above sounding — this is one of two places applying that shift; hit-test.ts
// (Stage 2) applies it in reverse.
const TREBLE_8VB_WRITTEN_SHIFT = 7;

const MEASURE_WIDTH = 220;
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
  const events = eventsForMeasure(score, partId, measureIndex);
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

// Everything a stave row contributes to the layout index except y0/y1: those
// need every row's topLineY first, so renderScore fills them in afterward.
type PartialStaveBox = Omit<StaveBox, "y0" | "y1">;

// Exported for testability: exercised directly with a fake RenderContext in
// renderer.test.ts, without needing a browser or jsdom.
export function drawStaveRow(
  ctx: RenderContext,
  score: Score,
  assignment: StaveAssignment,
  rowIndex: number,
): PartialStaveBox {
  const vexClef = toVexClefName(assignment.clef);
  const writtenShift =
    assignment.clef === "treble8vb" ? TREBLE_8VB_WRITTEN_SHIFT : 0;
  const y = SYSTEM_TOP_MARGIN + rowIndex * STAVE_ROW_HEIGHT;
  const measures: MeasureBox[] = [];
  let topLineY = 0;
  let lineSpacing = 0;

  for (
    let measureIndex = 0;
    measureIndex < score.measures.length;
    measureIndex++
  ) {
    const measure = score.measures[measureIndex];
    if (!measure) throw new Error(`No measure at index ${measureIndex}`);
    const x = SYSTEM_LEFT_MARGIN + measureIndex * MEASURE_WIDTH;
    const stave = new Stave(x, y, MEASURE_WIDTH);
    if (measureIndex === 0) {
      stave.addClef(
        vexClef,
        "default",
        assignment.clef === "treble8vb" ? "8vb" : undefined,
      );
      stave.addTimeSignature(
        `${measure.timeSig.beats}/${measure.timeSig.beatType}`,
      );
    }
    stave.setContext(ctx).draw();
    topLineY = stave.getYForLine(0);
    lineSpacing = stave.getSpacingBetweenLines();

    const partVoices = assignment.partIds.map((partId, indexInStave) =>
      buildVoiceForPart(
        score,
        partId,
        measureIndex,
        vexClef,
        writtenShift,
        stemFor(assignment.partIds.length, indexInStave),
      ),
    );
    const voices = partVoices.map((partVoice) => partVoice.voice);

    Accidental.applyAccidentals(
      voices,
      toVexKeySignature(keyAt(score, measure.startTick)),
    );
    // formatToStave (not a fixed width) accounts for the clef/time signature
    // already eating into measure 0's stave — a fixed width overflows past
    // the barline on exactly the measures that carry those modifiers.
    new Formatter().joinVoices(voices).formatToStave(voices, stave);
    voices.forEach((voice) => voice.draw(ctx, stave));

    // Real positions, not an equal split of MEASURE_WIDTH — VexFlow spaces
    // notes non-uniformly, so hit-test.ts interpolates between these
    // (falling back to noteStartX/noteEndX only outside their range).
    // Simultaneous notes across voices land on the same x (joinVoices), so
    // later voices simply overwrite earlier ones for a given tick.
    const anchorsByTick = new Map<number, number>();
    for (const partVoice of partVoices) {
      partVoice.events.forEach((event, i) =>
        anchorsByTick.set(event.tick, partVoice.notes[i]!.getAbsoluteX()),
      );
    }
    const noteAnchors: NoteAnchor[] = [...anchorsByTick.entries()]
      .map(([tick, x]) => ({ tick, x }))
      .sort((a, b) => a.tick - b.tick);

    measures.push({
      index: measureIndex,
      x0: stave.getNoteStartX(),
      x1: stave.getNoteEndX(),
      startTick: measure.startTick,
      endTick: measureEndTick(score, measure),
      noteAnchors,
    });
  }

  return {
    systemIndex: 0,
    staveIndex: rowIndex,
    clef: assignment.clef,
    partIds: assignment.partIds,
    x0: SYSTEM_LEFT_MARGIN,
    x1: SYSTEM_LEFT_MARGIN + score.measures.length * MEASURE_WIDTH,
    topLineY,
    lineSpacing,
    measures,
  };
}

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

  const partialBoxes = score.layout.staves.map((assignment, rowIndex) =>
    drawStaveRow(ctx, score, assignment, rowIndex),
  );
  const claimRegions = computeClaimRegions(
    partialBoxes.map((box) => box.topLineY),
  );
  const staves: StaveBox[] = partialBoxes.map((box, i) => ({
    ...box,
    ...claimRegions[i]!,
  }));

  return { staves };
}
